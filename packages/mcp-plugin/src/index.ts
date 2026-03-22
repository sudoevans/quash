#!/usr/bin/env node
import * as fs   from "fs";
import * as os   from "os";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Entry point ─────────────────────────────────────────────────────────────
if (process.argv[2] === "init") {
  runInit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  startMcpServer();
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(os.homedir(), ".quash", "config.json");

interface QuashConfig {
  privateKey: string;
  agentId:    string;
  apiBase:    string;
}

function loadConfig(): QuashConfig | null {
  let file: any = {};
  try { file = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")); } catch { /* no file */ }

  const privateKey = process.env.STACKS_PRIVATE_KEY ?? file.privateKey ?? null;
  if (!privateKey) return null;

  return {
    privateKey,
    agentId: process.env.QUASH_AGENT_ID ?? file.agentId ?? `claude-code@${os.hostname()}`,
    apiBase:  process.env.QUASH_API_URL  ?? file.apiBase  ?? "https://quash.fly.dev",
  };
}

function saveConfig(cfg: QuashConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

// ─── Init wizard ──────────────────────────────────────────────────────────────
async function runInit(): Promise<void> {
  // When stdin is piped (non-TTY), read all lines upfront before readline closes on EOF.
  // When interactive, use readline question() normally.
  let lineBuffer: string[] | null = null;
  if (!process.stdin.isTTY) {
    lineBuffer = await new Promise<string[]>(res => {
      const lines: string[] = [];
      const rl2 = readline.createInterface({ input: process.stdin });
      rl2.on("line", l => lines.push(l.trim()));
      rl2.on("close", () => res(lines));
    });
  }

  const rl = lineBuffer === null
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;

  const ask = (q: string): Promise<string> => {
    if (lineBuffer !== null) {
      // Piped mode: consume next pre-read line and echo it
      process.stdout.write(q);
      const ans = lineBuffer.shift() ?? "";
      process.stdout.write(ans + "\n");
      return Promise.resolve(ans);
    }
    return new Promise(res => rl!.question(q, ans => res(ans.trim())));
  };

  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║                    Quash Setup                       ║
  ║   AI error resolution — powered by human experts    ║
  ╚══════════════════════════════════════════════════════╝
`);
  console.log("  Quash needs a Stacks wallet to pay for solutions and post bounties.");
  console.log("  Your key is stored locally at ~/.quash/config.json — never sent anywhere.\n");

  const choice = await ask("  [1] Enter an existing Stacks private key\n  [2] Generate a new wallet now\n\n  Choice [1]: ");

  // Ask for key input before any async work (keeps readline open on piped stdin)
  let rawKey = "";
  if (choice !== "2") {
    rawKey = await ask("  Private key (hex): ");
    if (!rawKey) { console.error("  No key entered. Aborting."); rl?.close(); return; }
  }

  const defaultId = `claude-code@${os.hostname()}`;
  const agentId   = (await ask(`\n  Agent ID [${defaultId}]: `)) || defaultId;
  const apiBase   = (await ask("  API URL [https://quash.fly.dev]: ")) || "https://quash.fly.dev";

  rl?.close();

  // Now do async work after all input is collected
  let privateKey: string;
  let displayAddress: string;

  if (choice === "2") {
    console.log("\n  Generating wallet...");
    const { generateSecretKey, generateWallet } = await import("@stacks/wallet-sdk");
    const { getAddressFromPrivateKey, TransactionVersion } = await import("@stacks/transactions");

    const mnemonic = generateSecretKey();
    const wallet   = await generateWallet({ secretKey: mnemonic, password: "" });
    privateKey     = wallet.accounts[0].stxPrivateKey;
    displayAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);

    console.log("\n  ┌─────────────────────────────────────────────────────┐");
    console.log("  │  SAVE YOUR SEED PHRASE — it cannot be recovered     │");
    console.log("  └─────────────────────────────────────────────────────┘");
    console.log(`\n  ${mnemonic}\n`);
  } else {
    privateKey = rawKey;
    const { getAddressFromPrivateKey, TransactionVersion } = await import("@stacks/transactions");
    displayAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);
  }
  saveConfig({ privateKey, agentId, apiBase });

  // ── Install CLAUDE.md instructions into ~/.claude/CLAUDE.md ─────────────
  const claudeDir      = path.join(os.homedir(), ".claude");
  const globalClaudeMd = path.join(claudeDir, "CLAUDE.md");
  const quashMdDest    = path.join(claudeDir, "quash-instructions.md");
  const quashMdSrc     = path.join(__dirname, "..", "CLAUDE.md");

  let claudeMdInstalled = false;
  try {
    // Copy the plugin's CLAUDE.md to ~/.claude/quash-instructions.md
    if (fs.existsSync(quashMdSrc)) {
      if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true });
      fs.copyFileSync(quashMdSrc, quashMdDest);

      // Append @-reference to global CLAUDE.md if not already there
      const ref      = "@~/.claude/quash-instructions.md";
      let existing   = "";
      try { existing = fs.readFileSync(globalClaudeMd, "utf-8"); } catch { /* no file yet */ }

      if (!existing.includes(ref)) {
        const sep = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
        fs.writeFileSync(globalClaudeMd, `${existing}${sep}\n# Quash\n${ref}\n`, "utf-8");
      }
      claudeMdInstalled = true;
    }
  } catch (e) {
    // Non-fatal — user can add manually
  }

  // ── Print summary ────────────────────────────────────────────────────────
  console.log(`
  ✅  Config saved        ~/.quash/config.json
  ✅  Stacks address      ${displayAddress}
  ${claudeMdInstalled
    ? "✅  Agent instructions  ~/.claude/quash-instructions.md (referenced in ~/.claude/CLAUDE.md)"
    : "⚠️   Could not write agent instructions — add @~/.claude/quash-instructions.md to your CLAUDE.md manually"}

  Add this to ~/.claude/settings.json to enable Quash in Claude Code:

  {
    "mcpServers": {
      "quash": {
        "command": "npx",
        "args": ["-y", "quash-mcp"]
      }
    }
  }

  Restart Claude Code and you're live.
`);
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
function startMcpServer(): void {
  const server = new Server(
    { name: "quash-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, prompts: {} } }
  );

  // ── Tool list ──────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "quash_search_solution",
        description:
          "Search Quash's solution store for a fix to an error. " +
          "Always call this FIRST before posting a bounty. Returns solution IDs, " +
          "preview titles, and STX prices. Free — no payment required.",
        inputSchema: {
          type: "object",
          properties: {
            q:          { type: "string", description: "Space-separated keywords from the error message" },
            stack:      { type: "string", description: "Comma-separated domain tags e.g. alpine,node,docker" },
            error_type: { type: "string", description: "Error type from controlled vocabulary" },
            limit:      { type: "number", description: "Max results (1–20)" },
          },
          required: ["q"],
        },
      },
      {
        name: "quash_unlock_solution",
        description:
          "Unlock and retrieve the full Quash solution. Automatically pays in STX via x402. " +
          "Call this after informing the user of the solution title and cost.",
        inputSchema: {
          type: "object",
          properties: {
            solution_id: { type: "string", description: "The solution_id from quash_search_solution or quash_poll_status" },
            error_body:  { type: "object", description: "The full AgentQuery JSON body for this error" },
          },
          required: ["solution_id", "error_body"],
        },
      },
      {
        name: "quash_post_bounty",
        description:
          "Post an error as a live bounty when no solution exists. " +
          "Locks STX escrow on Stacks upfront. Returns a problem_id to poll with quash_poll_status.",
        inputSchema: {
          type: "object",
          properties: {
            error_body:   { type: "object", description: "The full AgentQuery JSON body for this error" },
            bounty:       { type: "string", description: "STX amount to offer e.g. '3'" },
            callback_url: { type: "string", description: "Optional webhook URL for status events" },
          },
          required: ["error_body", "bounty"],
        },
      },
      {
        name: "quash_poll_status",
        description:
          "Poll the status of a live Quash bounty. Call every 30 seconds after posting. " +
          "Returns: open | claimed | solution_ready | expired. " +
          "When solution_ready, call quash_unlock_solution with the returned solution_id.",
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
          "ALWAYS call this after attempting a solution — it powers quality ranking. " +
          "Outcome: resolved | partial | not_applicable | failed.",
        inputSchema: {
          type: "object",
          properties: {
            solution_id: { type: "string", description: "The solution_id that was applied" },
            payment_id:  { type: "string", description: "The payment_id from the unlock receipt" },
            outcome:     { type: "string", description: "resolved | partial | not_applicable | failed" },
            notes:       { type: "string", description: "Brief notes on the result" },
          },
          required: ["solution_id", "outcome"],
        },
      },
      {
        name: "quash_history",
        description:
          "Show this agent's Quash resolution history: dates, error signatures, STX spent, " +
          "outcomes, and estimated API compute saved.",
        inputSchema: {
          type: "object",
          properties: {
            days: { type: "number", description: "Days of history to show (default 30)" },
          },
        },
      },
    ],
  }));

  // ── Prompt list (slash commands) ──────────────────────────────────────────
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "quash:history",
        description: "Show your Quash error resolution history and spend summary",
      },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    if ((req.params as any).name === "quash:history") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Call quash_history and display the results as a clean terminal table with totals.",
            },
          },
        ],
      };
    }
    throw new Error(`Unknown prompt: ${(req.params as any).name}`);
  });

  // ── Tool handlers ──────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const config = loadConfig();
    if (!config) {
      return {
        content: [{
          type: "text",
          text: "⚠️  Quash not configured.\n\nRun: npx quash-mcp init\n\nThis takes 30 seconds and sets up your Stacks wallet for automatic payments.",
        }],
      };
    }

    const agentHeaders = {
      "X-Agent-Id": config.agentId,
      "Content-Type": "application/json",
    };

    switch (name) {

      // ── 1. Search ──────────────────────────────────────────────────────────
      case "quash_search_solution": {
        const url = new URL(`${config.apiBase}/solutions/search`);
        url.searchParams.set("q", (args as any).q);
        if ((args as any).stack)      url.searchParams.set("stack",      (args as any).stack);
        if ((args as any).error_type) url.searchParams.set("error_type", (args as any).error_type);
        if ((args as any).limit)      url.searchParams.set("limit",      String((args as any).limit));

        const res  = await fetch(url, { headers: agentHeaders });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      // ── 2. Unlock (x402 V2) ───────────────────────────────────────────────
      case "quash_unlock_solution": {
        const { solution_id, error_body } = args as any;
        const bodyStr = JSON.stringify(error_body);

        // Step A: initial request — expect 402 with payment-required header
        const stepA = await fetch(`${config.apiBase}/solve`, {
          method:  "POST",
          headers: agentHeaders,
          body:    bodyStr,
        });

        if (stepA.status === 200) {
          return { content: [{ type: "text", text: JSON.stringify(await stepA.json(), null, 2) }] };
        }

        if (stepA.status !== 402) {
          return { content: [{ type: "text", text: `Quash error ${stepA.status}: ${await stepA.text()}` }] };
        }

        const stepABody = await stepA.json();
        const x402Header = stepA.headers.get("payment-required");

        if (!x402Header) {
          // Fallback: no payment-required header, use X-Payment legacy path
          return {
            content: [{
              type: "text",
              text: [
                "⚠️  Solution found but payment header missing.",
                `Solution: ${stepABody.title ?? solution_id}`,
                `Amount: ${JSON.stringify(stepABody.payment_options?.[0])}`,
                "",
                "Raw 402 body:",
                JSON.stringify(stepABody, null, 2),
              ].join("\n"),
            }],
          };
        }

        // Parse x402 V2 payment-required header
        let x402: any;
        try {
          x402 = JSON.parse(Buffer.from(x402Header, "base64").toString("utf-8"));
        } catch {
          return { content: [{ type: "text", text: `Failed to parse payment-required header: ${x402Header}` }] };
        }

        const accept    = x402.accepts?.[0];
        const payTo     = accept?.payTo     ?? stepABody.payment_options?.[0]?.contract ?? "";
        const amountMicro = accept?.amount  ?? stepABody.payment_options?.[0]?.amount_micro ?? "0";
        const caip2     = accept?.network   ?? "stacks:2147483648";
        const resolvedSolutionId = stepABody.solution_id ?? solution_id;

        const isMainnet = caip2 === "stacks:1";

        // Build + sign STX transfer
        const {
          makeSTXTokenTransfer,
          getAddressFromPrivateKey,
          TransactionVersion,
          AnchorMode,
        } = await import("@stacks/transactions");

        const { StacksTestnet, StacksMainnet } = await import("@stacks/network");
        const stacksNetwork = isMainnet ? new StacksMainnet() : new StacksTestnet();

        const tx = await makeSTXTokenTransfer({
          recipient:   payTo,
          amount:      BigInt(amountMicro),
          senderKey:   config.privateKey,
          network:     stacksNetwork,
          fee:         2000,
          anchorMode:  AnchorMode.Any,
          memo:        `quash:${resolvedSolutionId}`.slice(0, 34),
        });

        const txHex = Buffer.from(tx.serialize()).toString("hex");

        const sigPayload = {
          x402Version: 2,
          accepted: { asset: "STX", network: caip2 },
          payload:  { transaction: txHex },
        };
        const sigHeader = Buffer.from(JSON.stringify(sigPayload)).toString("base64");

        // Derive sender address for receipt
        const senderAddress = getAddressFromPrivateKey(
          config.privateKey,
          isMainnet ? TransactionVersion.Mainnet : TransactionVersion.Testnet
        );

        // Step B: retry with payment-signature header
        const stepB = await fetch(`${config.apiBase}/solve`, {
          method:  "POST",
          headers: { ...agentHeaders, "payment-signature": sigHeader },
          body:    bodyStr,
        });

        const result = await stepB.json();
        if (stepB.ok) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                ...result,
                _payment_note: `Paid ${parseInt(amountMicro) / 1_000_000} STX from ${senderAddress}`,
              }, null, 2),
            }],
          };
        }

        return { content: [{ type: "text", text: `Payment step failed (${stepB.status}): ${JSON.stringify(result, null, 2)}` }] };
      }

      // ── 3. Post bounty ─────────────────────────────────────────────────────
      case "quash_post_bounty": {
        const { error_body, bounty, callback_url } = args as any;
        const payload = {
          ...error_body,
          bounty:       { amount: bounty, currency: "STX", expires_in: 7200 },
          agent:        { ...error_body.agent, bounty: parseFloat(bounty) },
          ...(callback_url ? { callback_url } : {}),
        };

        const res  = await fetch(`${config.apiBase}/problems`, {
          method:  "POST",
          headers: agentHeaders,
          body:    JSON.stringify(payload),
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      // ── 4. Poll status ─────────────────────────────────────────────────────
      case "quash_poll_status": {
        const { problem_id } = args as any;
        const res  = await fetch(`${config.apiBase}/problems/${problem_id}/status`, {
          headers: agentHeaders,
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      // ── 5. Report feedback ─────────────────────────────────────────────────
      case "quash_report_feedback": {
        const { solution_id, payment_id, outcome, notes } = args as any;
        const res  = await fetch(`${config.apiBase}/feedback`, {
          method:  "POST",
          headers: agentHeaders,
          body:    JSON.stringify({ solution_id, payment_id, outcome, notes }),
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      // ── 6. History ─────────────────────────────────────────────────────────
      case "quash_history": {
        const days = (args as any)?.days ?? 30;
        const url  = new URL(`${config.apiBase}/agents/history`);
        url.searchParams.set("days", String(days));

        const res  = await fetch(url, { headers: agentHeaders });
        if (!res.ok) {
          return { content: [{ type: "text", text: `Failed to fetch history: ${res.status}` }] };
        }

        const data: any = await res.json();
        const rows: any[] = data.history ?? [];

        if (rows.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No Quash resolutions in the last ${days} days.\n\nWhen you unlock solutions, they'll appear here.`,
            }],
          };
        }

        // Format as terminal table
        const COL = { date: 10, sig: 30, amount: 10, outcome: 10 };
        const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
        const line = "─".repeat(COL.date + COL.sig + COL.amount + COL.outcome + 9);

        const header = `  ${pad("DATE", COL.date)}  ${pad("SIGNATURE", COL.sig)}  ${pad("AMOUNT", COL.amount)}  OUTCOME`;
        const tableRows = rows.map((r: any) =>
          `  ${pad(r.date ?? "", COL.date)}  ${pad(r.signature ?? r.solution_title ?? "", COL.sig)}  ${pad((r.amount_stx ?? "?") + " STX", COL.amount)}  ${r.outcome ?? "?"}`
        ).join("\n");

        const totalStx = parseFloat(data.total_stx_spent ?? "0");
        const count    = data.resolution_count ?? rows.length;
        const saved    = (count * 1.40).toFixed(2);

        const summary = [
          `  ${line}`,
          `  Total spent (${days}d): ${totalStx.toFixed(4)} STX  ·  ${count} resolution${count !== 1 ? "s" : ""}`,
          `  Estimated compute saved: ~$${saved}  (avg 3 failed retries × 2k tokens × $0.024/1k)`,
        ].join("\n");

        return {
          content: [{
            type: "text",
            text: `  ${line}\n${header}\n  ${line}\n${tableRows}\n${summary}`,
          }],
        };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  });

  // ── Start ──────────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    process.stderr.write("✅ Quash MCP Plugin ready\n");
  });
}
