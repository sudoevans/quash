/**
 * Quash x402 Agent Demo
 *
 * Manually signs an STX transfer and sends it as the x402 payment-signature header.
 * This tests the full server-side flow without depending on the x402-stacks client interceptor.
 *
 * Run: node demo-agent.mjs
 */
import {
  makeSTXTokenTransfer,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  makeStandardSTXPostCondition,
  FungibleConditionCode,
  getAddressFromPrivateKey,
  TransactionVersion,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';

// Agent wallet (account 1 from mnemonic) — separate from the platform wallet
const PRIVATE_KEY   = '79d0816f1d5b0db7fd2c7162928deb99a45f432901a040204307e4823d2ea6f201';
const API_BASE      = 'http://localhost:4000';

const senderAddress = getAddressFromPrivateKey(PRIVATE_KEY, TransactionVersion.Testnet);
console.log('Agent wallet:', senderAddress);

// ── Step 1: hit /solve to get payment requirements ──────────────────────────
const query = {
  schema_version: '1.0',
  error: { message: 'busybox sed incompatible alpine', type: 'process_exit', exit_code: 1 },
  environment: { os: { family: 'linux', distro: 'alpine' } },
  agent: { id: senderAddress, urgency: 'urgent' },
};

const step1 = await fetch(`${API_BASE}/solve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Agent-Id': senderAddress },
  body: JSON.stringify(query),
});

if (step1.status !== 402) {
  console.error('Expected 402, got:', step1.status, await step1.text());
  process.exit(1);
}

const paymentRequiredHeader = step1.headers.get('payment-required');
const paymentRequired = JSON.parse(Buffer.from(paymentRequiredHeader, 'base64').toString('utf-8'));
const accepted = paymentRequired.accepts[0];

console.log(`\nPayment required: ${accepted.amount} microSTX → ${accepted.payTo}`);
console.log('Solution preview:', (await step1.json()).title);

// ── Step 2: sign STX transfer (don't broadcast) ─────────────────────────────
console.log('\nSigning STX transfer...');
const network = new StacksTestnet();
const tx = await makeSTXTokenTransfer({
  recipient: accepted.payTo,
  amount:    BigInt(accepted.amount),
  senderKey: PRIVATE_KEY,
  network,
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Deny,
  postConditions: [
    makeStandardSTXPostCondition(senderAddress, FungibleConditionCode.Equal, BigInt(accepted.amount)),
  ],
  memo: 'quash-x402',
  fee: 2000n,
});

// Serialize to hex — this is what x402 client sends without broadcasting
const txHex = Buffer.from(tx.serialize()).toString('hex');
console.log('Tx hex (first 40 chars):', txHex.slice(0, 40) + '...');

// ── Step 3: encode as x402 payment-signature payload ────────────────────────
const paymentPayload = {
  x402Version: 2,
  resource: paymentRequired.resource,
  accepted,
  payload: { transaction: txHex },
};
const paymentSig = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

// ── Step 4: retry /solve with payment-signature ──────────────────────────────
console.log('\nSending payment-signature to /solve...');
console.log('(Server will broadcast tx and poll for confirmation — may take ~30s)\n');

const step2 = await fetch(`${API_BASE}/solve`, {
  method: 'POST',
  headers: {
    'Content-Type':    'application/json',
    'X-Agent-Id':      senderAddress,
    'payment-signature': paymentSig,
  },
  body: JSON.stringify(query),
});

const result = await step2.json();

if (!step2.ok) {
  console.error('Payment failed:', JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log('=== Solution Unlocked ===');
console.log('Title:       ', result.solution.title);
console.log('Tx hash:     ', result.payment_receipt.tx_hash);
console.log('Payer:       ', result.payment_receipt.payer);
console.log('Confirmed at:', result.payment_receipt.confirmed_at);
console.log('\nFirst step:', result.solution.steps?.[0]?.instruction);
