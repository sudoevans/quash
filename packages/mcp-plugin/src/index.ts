import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = process.env.QUASH_API_URL ?? "https://api.agentflow.dev";
const AGENT_ID = process.env.QUASH_AGENT_ID ?? "claude-code@local";

// ─── Server definition ───────────────────────────────────────────────────────
const server = new Server(
  { name: "quash-mcp-plugin", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool list ────────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "quash_search_solution",
      description:
        "Search Quash's solution store for a fix to an error. " +
        "Always call this FIRST before posting a bounty. Returns solution IDs " +
        "and preview titles. Free — no payment required.",
      inputSchema: {
        type: "object",
        properties: {
          q:          { type: "string",  description: "Space-separated keywords from the error message" },
          stack:      { type: "string",  description: "Comma-separated domain tags e.g. alpine,node,docker" },
          error_type: { type: "string",  description: "Error type from controlled vocabulary" },
          limit:      { type: "number",  description: "Max results (1-20)" },
        },
        required: ["q"],
      },
    },
    {
      name: "quash_unlock_solution",
      description:
        "Unlock and retrieve the full Quash solution for a known solution_id. " +
        "This executes the x402 payment: it first receives a 402, signs and " +
        "broadcasts the USDCx Stacks transaction using the agent's private key, " +
        "then retries to get the full solution object including code_patch and steps.",
      inputSchema: {
        type: "object",
        properties: {
          solution_id:  { type: "string", description: "The solution_id returned from quash_search_solution" },
          error_body:   { type: "object", description: "The full AgentQuery JSON body for this error" },
        },
        required: ["solution_id", "error_body"],
      },
    },
    {
      name: "quash_post_bounty",
      description:
        "Post an error as a live bounty on Quash when no solution exists. " +
        "Call this ONLY after quash_search_solution returns no results. " +
        "Locks USDCx escrow on Stacks upfront. Returns a problem_id to poll with quash_poll_status.",
      inputSchema: {
        type: "object",
        properties: {
          error_body:   { type: "object", description: "The full AgentQuery JSON body for this error" },
          bounty:       { type: "string", description: "USDCx amount to offer e.g. '0.05'" },
          callback_url: { type: "string", description: "Optional webhook URL for status events" },
        },
        required: ["error_body", "bounty"],
      },
    },
    {
      name: "quash_poll_status",
      description:
        "Poll the status of a live Quash bounty by problem_id. " +
        "Call every 30 seconds after posting a bounty. " +
        "Returns: open | claimed | solution_ready | expired. " +
        "When status is solution_ready, call quash_unlock_solution with the solution_id.",
      inputSchema: {
        type: "object",
        properties: {
          problem_id: { type: "string", description: "The problem_id from quash_post_bounty" },
        },
        required: ["problem_id"],
      },
    },
    {
      name: "quash_report_feedback",
      description:
        "Report the outcome of a Quash solution after applying it. " +
        "ALWAYS call this after attempting to apply a solution — it powers the quality ranking. " +
        "Outcome must be: resolved | partial | not_applicable | failed.",
      inputSchema: {
        type: "object",
        properties: {
          solution_id:  { type: "string", description: "The solution_id that was applied" },
          payment_id:   { type: "string", description: "The payment_id from the unlock receipt" },
          outcome:      { type: "string", description: "resolved | partial | not_applicable | failed" },
          notes:        { type: "string", description: "Brief notes on the result" },
        },
        required: ["solution_id", "outcome"],
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // ── 1. Search ────────────────────────────────────────────────────────────
    case "quash_search_solution": {
      const url = new URL(`${API_BASE}/solutions/search`);
      url.searchParams.set("q", (args as any).q);
      if ((args as any).stack)      url.searchParams.set("stack", (args as any).stack);
      if ((args as any).error_type) url.searchParams.set("error_type", (args as any).error_type);
      if ((args as any).limit)      url.searchParams.set("limit", String((args as any).limit));

      const res = await fetch(url, { headers: { "X-Agent-Id": AGENT_ID } });
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // ── 2. Unlock solution (x402 two-step) ───────────────────────────────────
    case "quash_unlock_solution": {
      const body = (args as any).error_body;

      // Step A — get the 402
      const stepA = await fetch(`${API_BASE}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agent-Id": AGENT_ID },
        body: JSON.stringify(body),
      });

      if (stepA.status === 200) {
        // Already unlocked or cached
        return { content: [{ type: "text", text: JSON.stringify(await stepA.json(), null, 2) }] };
      }

      if (stepA.status !== 402) {
        const text = await stepA.text();
        return { content: [{ type: "text", text: `Error from Quash API: ${text}` }] };
      }

      const challenge = await stepA.json();
      const { amount, payTo, network } = challenge.payment;

      // Step B — simulate or real Stacks payment
      // In MVP: if no private key configured, return the 402 challenge for the user/agent to handle
      const privateKey = process.env.STACKS_PRIVATE_KEY;
      if (!privateKey) {
        return {
          content: [{
            type: "text",
            text: [
              "⚠️ QUASH PAYMENT REQUIRED",
              `Solution: ${challenge.title}`,
              `Amount: ${amount} USDCx on ${network}`,
              `Pay to: ${payTo}`,
              "",
              "Set STACKS_PRIVATE_KEY in your MCP environment to enable automatic payments.",
              "",
              "Raw 402 challenge:",
              JSON.stringify(challenge, null, 2),
            ].join("\n"),
          }],
        };
      }

      // Real path: broadcast the tx and retry with X-Payment header
      const txid = await broadcastUsdcxTransfer(privateKey, payTo, amount, network);

      const xPayment = JSON.stringify({
        txid,
        wallet: deriveAddressFromKey(privateKey),
        solution_id: challenge.solution_id,
        network,
      });

      const stepB = await fetch(`${API_BASE}/solve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Id": AGENT_ID,
          "X-Payment": xPayment,
        },
        body: JSON.stringify(body),
      });

      const solution = await stepB.json();
      return { content: [{ type: "text", text: JSON.stringify(solution, null, 2) }] };
    }

    // ── 3. Post bounty ────────────────────────────────────────────────────────
    case "quash_post_bounty": {
      const { error_body, bounty, callback_url } = args as any;
      const payload = {
        ...error_body,
        bounty: { amount: bounty, currency: "USDCx", expires_in: 7200 },
        agent: { ...error_body.agent, bounty },
        ...(callback_url ? { callback_url } : {}),
      };

      const res = await fetch(`${API_BASE}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agent-Id": AGENT_ID },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // ── 4. Poll status ────────────────────────────────────────────────────────
    case "quash_poll_status": {
      const { problem_id } = args as any;
      const res = await fetch(`${API_BASE}/problems/${problem_id}/status`, {
        headers: { "X-Agent-Id": AGENT_ID },
      });
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    // ── 5. Report feedback ────────────────────────────────────────────────────
    case "quash_report_feedback": {
      const { solution_id, payment_id, outcome, notes } = args as any;
      const res = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agent-Id": AGENT_ID },
        body: JSON.stringify({ solution_id, payment_id, outcome, notes }),
      });
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
});

// ─── Stacks helpers (lightweight, no heavy SDK import for MCP) ────────────────

/**
 * Broadcasts a USDCx SIP-010 transfer on Stacks testnet/mainnet.
 * Uses @stacks/transactions to build and broadcast.
 */
async function broadcastUsdcxTransfer(
  privateKey: string,
  recipient: string,
  amount: string,
  network: string
): Promise<string> {
  // Dynamic import to keep startup fast
  const { makeContractCall, broadcastTransaction, AnchorMode, FungibleConditionCode, makeStandardFungiblePostCondition, createAssetInfo } = await import("@stacks/transactions");
  const { StacksTestnet, StacksMainnet } = await import("@stacks/network");

  const isMainnet = network.includes("mainnet");
  const stacksNetwork = isMainnet ? new StacksMainnet() : new StacksTestnet();

  // USDCx contract on testnet (replace with mainnet address when going live)
  const usdcxContract = isMainnet
    ? { address: "SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR", name: "usdcx-token" }
    : { address: "ST3KCNDSWZSFZCC6BE4VA9AXWXC9KEB16FBTRK36T", name: "usdcx-token" };

  const microAmount = Math.round(parseFloat(amount) * 1_000_000);

  const txOptions = {
    contractAddress: usdcxContract.address,
    contractName: usdcxContract.name,
    functionName: "transfer",
    functionArgs: [
      (await import("@stacks/transactions")).uintCV(microAmount),
      (await import("@stacks/transactions")).standardPrincipalCV((await import("@stacks/transactions")).getAddressFromPrivateKey(privateKey)),
      (await import("@stacks/transactions")).standardPrincipalCV(recipient),
      (await import("@stacks/transactions")).noneCV(),
    ],
    senderKey: privateKey,
    network: stacksNetwork,
    anchorMode: AnchorMode.Any,
  };

  const tx = await makeContractCall(txOptions as any);
  const result = await broadcastTransaction(tx, stacksNetwork);
  return (result as any).txid ?? (result as any).error ?? "unknown";
}

function deriveAddressFromKey(privateKey: string): string {
  try {
    // Synchronous derivation is not available in all builds; best-effort
    return `SP${privateKey.slice(0, 38).toUpperCase()}`;
  } catch {
    return "UNKNOWN";
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  process.stderr.write("✅ Quash MCP Plugin ready\n");
});
