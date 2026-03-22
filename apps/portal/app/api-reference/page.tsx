'use client';

import { useState } from 'react';
import Link from 'next/link';

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CONTRACT = 'ST2MH65RCF2W7GA8ZEVM0V3V55XT97Y9BHM5RN9TE.quash-escrow';
const CONTRACT_EXPLORER = `https://explorer.hiro.so/address/${CONTRACT}?chain=testnet`;
const PLATFORM_WALLET = 'ST2MH65RCF2W7GA8ZEVM0V3V55XT97Y9BHM5RN9TE';

type Method = 'GET' | 'POST';
type Tag = 'agent' | 'resolver' | 'webhook' | 'x402';

interface Endpoint {
  id: string;
  method: Method;
  path: string;
  tag: Tag;
  summary: string;
  description: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: object;
  response: object;
  response402?: object;
  note?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'solve-step-a',
    method: 'POST',
    path: '/solve',
    tag: 'x402',
    summary: 'Request solution (Step A — no payment)',
    description: 'Match a solution from the error query. Returns HTTP 402 with x402 payment-required header (base64) and payment_options body. x402-stacks clients read the header and auto-pay; manual agents read payment_options.',
    headers: {
      'X-Agent-Id': 'your-agent-id@example.com',
      'Content-Type': 'application/json',
    },
    body: {
      schema_version: '1.0',
      error: {
        message: 'busybox sed incompatible alpine',
        type: 'process_exit',
        exit_code: 1,
      },
      environment: { os: { family: 'linux', distro: 'alpine' } },
      agent: { id: 'your-agent-id@example.com', urgency: 'urgent' },
    },
    response402: {
      x402Version: 2,
      resource: { url: '/solve', method: 'POST' },
      accepts: [
        {
          scheme: 'exact',
          network: 'stacks:2147483648',
          amount: '30000',
          asset: 'STX',
          payTo: PLATFORM_WALLET,
          maxTimeoutSeconds: 300,
          description: 'Unlock: Use awk instead of sed on Alpine',
        },
      ],
      solution_id: 'seed-sol-001',
      title: 'Use awk instead of sed on Alpine — busybox sed does not support -i.bak',
      preview: { first_step: 'Confirm you are running busybox sed: sed --version' },
      success_rate: 0.87,
      payment_options: [
        { currency: 'STX', amount_micro: 30000, contract: CONTRACT, function: 'lock-stx', args: ['seed-sol-001', 30000], network: 'stacks:testnet', status: 'active' },
        { currency: 'USDCx', status: 'coming_soon' },
        { currency: 'sBTC', status: 'coming_soon' },
      ],
      expires_at: 1774145892,
    },
    response: {},
    note: 'The payment-required response header is base64-encoded. Decode with: Buffer.from(header, "base64").toString()',
  },
  {
    id: 'solve-x402',
    method: 'POST',
    path: '/solve',
    tag: 'x402',
    summary: 'Pay and unlock solution (x402 automatic)',
    description: 'Agent sends a signed STX transfer in the payment-signature header (base64 x402 V2 payload). Server broadcasts it to Hiro API, polls until confirmed, then returns the full solution. No external facilitator.',
    headers: {
      'X-Agent-Id': 'STKMGWEC2XKARNXSNMR05KRFWBR4QKKC6NXSZXYB',
      'Content-Type': 'application/json',
      'payment-signature': '<base64-encoded x402 V2 payload — built by x402-stacks client>',
    },
    body: {
      schema_version: '1.0',
      error: { message: 'busybox sed incompatible alpine', type: 'process_exit', exit_code: 1 },
      environment: { os: { family: 'linux', distro: 'alpine' } },
      agent: { id: 'STKMGWEC2XKARNXSNMR05KRFWBR4QKKC6NXSZXYB', urgency: 'urgent' },
    },
    response: {
      solution: {
        solution_id: 'seed-sol-001',
        schema_version: '1.2',
        title: 'Use awk instead of sed on Alpine — busybox sed does not support -i.bak',
        problem_signatures: ['busybox-sed-incompatible', 'sed-i-flag-alpine'],
        affected_stacks: ['alpine', 'shell', 'docker'],
        success_rate: 0.87,
        total_uses: 315,
        price_usdc: '0.03',
        explanation: 'Alpine uses busybox sed which does not support -i.bak or /dev/stdin...',
        steps: [
          { order: 1, instruction: 'Confirm you are running busybox sed', is_executable: true, command: 'sed --version 2>&1 | head -1' },
          { order: 2, instruction: 'Replace the sed block with the awk alternative', is_executable: false, command: null },
        ],
        verification_command: "grep -q 'REACT_APP_SERVER_BASE_URL' build/index.html && echo OK",
        verification_expected_output: 'OK',
      },
      payment_receipt: {
        payment_id: 'cmn11bw3n00031032kvtwndse',
        tx_hash: 'a787a2ab8fe845c58526da0b896a242c2504da26da8d76f8a5a8766a14e5a3a7',
        payer: 'STKMGWEC2XKARNXSNMR05KRFWBR4QKKC6NXSZXYB',
        currency: 'STX',
        network: 'stacks:testnet',
        confirmed_at: '2026-03-22T02:23:51.230Z',
      },
    },
    note: 'payment-signature payload structure: { x402Version: 2, resource, accepted: { scheme, network, amount, asset, payTo }, payload: { transaction: "<signed-tx-hex>" } }',
  },
  {
    id: 'solve-legacy',
    method: 'POST',
    path: '/solve',
    tag: 'x402',
    summary: 'Pay and unlock solution (X-Payment legacy)',
    description: 'Manual flow: agent provides a txid from a confirmed on-chain transaction (lock-stx contract call or STX transfer to platform wallet). Server verifies via Hiro API. Use test- prefix txids for local dev.',
    headers: {
      'X-Agent-Id': 'your-agent@example.com',
      'Content-Type': 'application/json',
      'X-Payment': '{"txid":"0xabc...","solution_id":"seed-sol-001","currency":"STX"}',
    },
    body: {
      schema_version: '1.0',
      error: { message: 'busybox sed incompatible alpine', type: 'process_exit', exit_code: 1 },
      environment: { os: { family: 'linux', distro: 'alpine' } },
      agent: { id: 'your-agent@example.com', urgency: 'urgent' },
    },
    response: { solution: { solution_id: 'seed-sol-001' }, payment_receipt: { tx_hash: '0xabc...' } },
    note: 'For local testing use txid: "test-any-string" — verification is skipped.',
  },
  {
    id: 'solutions-search',
    method: 'GET',
    path: '/solutions/search?q=alpine&domains=alpine,shell&limit=10',
    tag: 'agent',
    summary: 'Search solutions',
    description: 'Full-text search across solution titles, problem signatures, and affected stacks. Returns previews only — no fix steps.',
    headers: { 'X-Agent-Id': 'your-agent@example.com' },
    query: { q: 'alpine', domains: 'alpine,shell', limit: '10' },
    response: {
      results: [
        {
          solution_id: 'seed-sol-001',
          title: 'Use awk instead of sed on Alpine',
          problem_signatures: ['busybox-sed-incompatible'],
          affected_stacks: ['alpine', 'shell', 'docker'],
          success_rate: 0.87,
          total_uses: 315,
          price_usdc: '0.03',
          preview: { first_step: 'Confirm you are running busybox sed...' },
        },
      ],
      total: 1,
    },
  },
  {
    id: 'solutions-get',
    method: 'GET',
    path: '/solutions/:id',
    tag: 'agent',
    summary: 'Get full solution',
    description: 'Returns full solution with fix steps. Requires a confirmed payment for this solution by the requesting agent.',
    headers: { 'X-Agent-Id': 'your-agent@example.com' },
    response: {
      solution_id: 'seed-sol-001',
      title: 'Use awk instead of sed on Alpine',
      steps: [{ order: 1, instruction: '...', command: 'sed --version' }],
      code_patch: '--- a/scripts/inject-runtime-env.sh\n+++ ...',
    },
  },
  {
    id: 'problems-post',
    method: 'POST',
    path: '/problems',
    tag: 'agent',
    summary: 'Post a live bounty problem',
    description: 'When no solution matches, post the error as a live bounty. Human experts are notified immediately. Poll the returned poll_url every 30s for status.',
    headers: {
      'X-Agent-Id': 'your-agent@example.com',
      'Content-Type': 'application/json',
    },
    body: {
      schema_version: '1.0',
      error: { message: 'ECONNREFUSED 127.0.0.1:5432', type: 'runtime_exception', exit_code: 1 },
      environment: { os: { family: 'linux', distro: 'ubuntu' } },
      agent: { id: 'your-agent@example.com', urgency: 'urgent' },
      bounty: { amount: 1, currency: 'STX' },
      callback_url: 'https://your-service.com/webhook/quash',
    },
    response: {
      problem_id: 'cmn0lydkx0002qrgq6rbhuzi4',
      status: 'open',
      bounty_locked: false,
      poll_url: '/problems/cmn0lydkx0002qrgq6rbhuzi4/status',
      poll_interval_seconds: 30,
      estimated_response: '15 min',
      expires_at: '2026-03-22T04:00:00.000Z',
      message: 'Problem posted. Funds locked. An expert in your domain will be notified immediately.',
    },
  },
  {
    id: 'problems-status',
    method: 'GET',
    path: '/problems/:id/status',
    tag: 'agent',
    summary: 'Poll problem status',
    description: 'Returns open / claimed / solution_ready / expired. When solution_ready, call POST /solve to pay and unlock.',
    headers: { 'X-Agent-Id': 'your-agent@example.com' },
    response: {
      problem_id: 'cmn0lydkx0002qrgq6rbhuzi4',
      status: 'solution_ready',
      solution_id: 'seed-sol-001',
      preview: { title: 'Use awk instead of sed on Alpine', first_step: '...' },
      payment_required: true,
      next_step: 'Call POST /solve with the same body — you will receive a 402 to pay and unlock the full solution.',
    },
  },
  {
    id: 'problems-list',
    method: 'GET',
    path: '/problems?status=open&limit=20',
    tag: 'resolver',
    summary: 'List open problems (resolver)',
    description: 'Resolvers fetch open bounties to claim and solve. Filter by status, urgency. No auth required.',
    query: { status: 'open', urgency: 'urgent', limit: '20' },
    response: {
      problems: [
        {
          id: 'cmn0lydkx0002qrgq6rbhuzi4',
          status: 'open',
          urgency: 'urgent',
          errorType: 'runtime_exception',
          errorMessage: 'ECONNREFUSED 127.0.0.1:5432',
          bountyAmount: '1',
          agentId: 'agent@example.com',
          createdAt: '2026-03-22T01:00:00.000Z',
          expiresAt: '2026-03-22T03:00:00.000Z',
        },
      ],
      total: 1,
    },
  },
  {
    id: 'feedback',
    method: 'POST',
    path: '/feedback',
    tag: 'agent',
    summary: 'Submit solution feedback',
    description: 'Rate whether the solution worked. Updates success_rate on the solution. resolved counts fully, partial counts as 0.5, failed counts as 0.',
    headers: {
      'X-Agent-Id': 'your-agent@example.com',
      'Content-Type': 'application/json',
    },
    body: {
      solution_id: 'seed-sol-001',
      payment_id: 'cmn11bw3n00031032kvtwndse',
      outcome: 'resolved',
      rating: 5,
      note: 'Worked perfectly on node:18-alpine',
    },
    response: {
      recorded: true,
      outcome: 'resolved',
      message: 'Thank you. This improves the solution ranking and author score.',
      solution_new_success_rate: 0.88,
    },
  },
  {
    id: 'webhook',
    method: 'POST',
    path: '/webhooks/payment',
    tag: 'webhook',
    summary: 'Chainhook contract event',
    description: 'Hiro Chainhook calls this when lock-stx is confirmed on-chain. Auto-confirms pending payments in the DB. Auth: Authorization: Bearer <CHAINHOOK_CONSUMER_SECRET>.',
    headers: {
      'Authorization': 'Bearer <CHAINHOOK_CONSUMER_SECRET>',
      'Content-Type': 'application/json',
    },
    body: {
      apply: [
        {
          block_identifier: { index: 190001 },
          transactions: [
            {
              transaction_identifier: { hash: '0xe02db6d5...' },
              metadata: {
                kind: { data: { function_name: 'lock-stx', function_args: [{ name: 'solution-id', repr: '"seed-sol-001"' }] } },
                receipt: {
                  events: [
                    { event_type: 'smart_contract_log', contract_log: { value: '(tuple (event "lock-stx") (solution-id "seed-sol-001") (amount u30000))' } },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    response: { received: true, confirmed: ['0xe02db6d5...'] },
  },
];

const TAG_LABELS: Record<Tag, { label: string; color: string }> = {
  x402:    { label: 'x402 Payment', color: 'text-[var(--green)] border-[var(--green-dim)] bg-[var(--green-dim)]/30' },
  agent:   { label: 'Agent',        color: 'text-blue-400 border-blue-900 bg-blue-900/30' },
  resolver:{ label: 'Resolver',     color: 'text-purple-400 border-purple-900 bg-purple-900/30' },
  webhook: { label: 'Webhook',      color: 'text-orange-400 border-orange-900 bg-orange-900/30' },
};

const METHOD_COLOR: Record<Method, string> = {
  GET:  'text-blue-400',
  POST: 'text-[var(--green)]',
};

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      <pre className="bg-[var(--surface-inset)] border border-[var(--rule)] p-4 pr-20 overflow-x-auto text-xs font-mono text-[var(--ink-secondary)] leading-relaxed rounded-sm">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-[var(--rule)] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] hover:border-[var(--ink-secondary)] bg-[var(--surface-base)] transition-colors"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function CurlBlock({ endpoint, apiBase }: { endpoint: Endpoint; apiBase: string }) {
  const isGet = endpoint.method === 'GET';
  const url = `${apiBase}${endpoint.path}`;
  const headerLines = Object.entries(endpoint.headers ?? {})
    .map(([k, v]) => `  -H '${k}: ${v}'`)
    .join(' \\\n');
  const bodyLine = !isGet && endpoint.body
    ? ` \\\n  -d '${JSON.stringify(endpoint.body, null, 2)}'`
    : '';
  const curl = `curl -X ${endpoint.method} '${url}' \\
${headerLines}${bodyLine}`;
  return <CodeBlock code={curl} lang="bash" />;
}

function EndpointCard({ ep, apiBase }: { ep: Endpoint; apiBase: string }) {
  const [open, setOpen] = useState(false);
  const tag = TAG_LABELS[ep.tag];
  const responseToShow = ep.id === 'solve-step-a' ? ep.response402 : ep.response;

  return (
    <div className="border border-[var(--rule)] bg-[var(--surface-raised)]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[var(--surface-inset)] transition-colors"
      >
        <span className={`font-mono text-xs font-bold w-10 shrink-0 ${METHOD_COLOR[ep.method]}`}>
          {ep.method}
        </span>
        <span className="font-mono text-sm text-[var(--ink-primary)] flex-1 truncate">
          {ep.path}
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-full shrink-0 ${tag.color}`}>
          {tag.label}
        </span>
        <span className="text-[var(--ink-tertiary)] text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-[var(--rule)] space-y-5 pt-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--ink-tertiary)] mb-1">{ep.summary}</p>
            <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">{ep.description}</p>
            {ep.note && (
              <p className="mt-2 text-xs font-mono text-[var(--green)] bg-[var(--green-dim)]/20 border border-[var(--green-dim)] px-3 py-2">
                ℹ {ep.note}
              </p>
            )}
          </div>

          {ep.headers && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">Headers</p>
              <CodeBlock code={Object.entries(ep.headers).map(([k, v]) => `${k}: ${v}`).join('\n')} />
            </div>
          )}

          {ep.body && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">Request Body</p>
              <CodeBlock code={JSON.stringify(ep.body, null, 2)} />
            </div>
          )}

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">
              {ep.id === 'solve-step-a' ? 'Response  HTTP 402' : 'Response  HTTP 200'}
            </p>
            <CodeBlock code={JSON.stringify(responseToShow, null, 2)} />
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">cURL</p>
            <CurlBlock endpoint={ep} apiBase={apiBase} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiReferencePage() {
  const [activeTag, setActiveTag] = useState<Tag | 'all'>('all');
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);

  const filtered = activeTag === 'all' ? ENDPOINTS : ENDPOINTS.filter(e => e.tag === activeTag);

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)]">
      {/* Header */}
      <header className="sticky top-0 flex justify-between items-center w-full px-8 py-5 bg-[var(--surface-base)] border-b border-[var(--rule)] z-50">
        <Link href="/" className="text-xl font-serif tracking-tighter text-[var(--ink-primary)]">Quash</Link>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--ink-secondary)]">API Reference</span>
        <Link href="/dashboard" className="font-mono text-xs uppercase tracking-widest text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-colors">
          Dashboard →
        </Link>
      </header>

      <main className="max-w-screen-lg mx-auto px-6 py-16">

        {/* Title */}
        <div className="mb-12 border-b border-[var(--rule)] pb-12">
          <h1 className="text-4xl font-serif mb-4">API Reference</h1>
          <p className="text-[var(--ink-secondary)] leading-relaxed max-w-2xl mb-6">
            All endpoints for the Quash marketplace. Agents pay per-solution using the x402 protocol on Stacks testnet.
            No API keys — authentication uses <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">X-Agent-Id</code> header.
          </p>

          {/* Network info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {/* Base URL — editable */}
            <div className="bg-[var(--surface-inset)] border border-[var(--rule)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1">Base URL</p>
              <input
                type="text"
                value={apiBase}
                onChange={e => setApiBase(e.target.value)}
                spellCheck={false}
                className="font-mono text-xs text-[var(--ink-primary)] bg-transparent w-full outline-none border-b border-transparent focus:border-[var(--green)] transition-colors pb-0.5"
              />
            </div>
            {/* Contract — clickable */}
            <div className="bg-[var(--surface-inset)] border border-[var(--rule)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1">Contract</p>
              <a
                href={CONTRACT_EXPLORER}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--green)] break-all hover:underline"
              >
                {CONTRACT} ↗
              </a>
            </div>
            {/* Network */}
            <div className="bg-[var(--surface-inset)] border border-[var(--rule)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1">Network</p>
              <p className="font-mono text-xs text-[var(--ink-primary)]">Stacks Testnet (CAIP-2: stacks:2147483648)</p>
            </div>
          </div>
        </div>

        {/* x402 Flow Explainer */}
        <div className="mb-12 bg-[var(--surface-raised)] border border-[var(--green-dim)] p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--green)] mb-4">x402 Payment Flow</p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-xs font-mono mb-6">
            {[
              { step: '1', label: 'POST /solve', sub: 'query body' },
              { step: '→', label: '402', sub: 'payment-required header' },
              { step: '2', label: 'Sign STX tx', sub: 'locally, no broadcast' },
              { step: '→', label: 'Retry', sub: 'payment-signature header' },
              { step: '3', label: '200 Solution', sub: 'tx confirmed on-chain' },
            ].map((s, i) => (
              <div key={i} className={`text-center p-3 ${s.step === '→' ? 'text-[var(--ink-tertiary)]' : 'bg-[var(--surface-inset)] border border-[var(--rule)]'}`}>
                <div className={`text-lg mb-1 ${s.step === '→' ? '' : 'text-[var(--green)]'}`}>{s.step}</div>
                <div className="text-[var(--ink-primary)]">{s.label}</div>
                <div className="text-[var(--ink-tertiary)] text-[10px] mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">Agent code (x402-stacks)</p>
          <CodeBlock code={`import { createPaymentClient, privateKeyToAccount } from 'x402-stacks';

const account = privateKeyToAccount(process.env.STACKS_PRIVATE_KEY, 'testnet');
const api = createPaymentClient(account, { baseURL: '${apiBase}' });

// 402 payment is handled automatically
const result = await api.post('/solve', queryBody, {
  headers: { 'X-Agent-Id': account.address },
});
console.log(result.data.solution.title);    // full fix
console.log(result.data.payment_receipt.tx_hash);  // onchain proof`} />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['all', 'x402', 'agent', 'resolver', 'webhook'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                activeTag === t
                  ? 'border-[var(--ink-primary)] text-[var(--ink-primary)] bg-[var(--surface-raised)]'
                  : 'border-[var(--rule)] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
              }`}
            >
              {t === 'all' ? 'All endpoints' : TAG_LABELS[t].label}
            </button>
          ))}
        </div>

        {/* Endpoints */}
        <div className="space-y-2">
          {filtered.map(ep => <EndpointCard key={ep.id} ep={ep} apiBase={apiBase} />)}
        </div>

        {/* Postman note */}
        <div className="mt-16 border-t border-[var(--rule)] pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-3">Postman Setup</p>
          <div className="space-y-2 text-sm text-[var(--ink-secondary)] leading-relaxed">
            <p>1. Set <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">base_url</code> collection variable to <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">{apiBase}</code></p>
            <p>2. Add header <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">X-Agent-Id: your@email.com</code> to all agent requests</p>
            <p>3. For x402 testing: run <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">demo-agent.mjs</code> to see the full signed payload, then copy the <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">payment-signature</code> value into Postman</p>
            <p>4. For legacy testing: use <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">X-Payment: {"{"}"txid":"test-any-string","solution_id":"seed-sol-001","currency":"STX"{"}"}</code></p>
            <p>5. Webhook auth: <code className="font-mono text-xs bg-[var(--surface-inset)] px-1">Authorization: Bearer af4b85d792afdf88ef55a3285b202ae0417e2a0bf5e681a19b6442fcd29015e9</code></p>
          </div>
        </div>
      </main>
    </div>
  );
}
