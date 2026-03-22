/**
 * Quash x402 Agent Demo
 *
 * Shows how an AI agent with a Stacks private key hits POST /solve.
 * Payment is fully automatic — the x402-stacks client handles the 402 flow.
 *
 * Usage:
 *   STACKS_PRIVATE_KEY=<hex-private-key> node --loader ts-node/esm src/scripts/demo-agent.mts
 *
 * Or export the key first:
 *   export STACKS_PRIVATE_KEY=<hex-private-key>
 *   node --loader ts-node/esm src/scripts/demo-agent.mts
 */
import axios from 'axios';
import { createPaymentClient, privateKeyToAccount } from 'x402-stacks';

const PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY;
const API_BASE    = process.env.API_BASE ?? 'http://localhost:4000';

if (!PRIVATE_KEY) {
  console.error('Error: set STACKS_PRIVATE_KEY environment variable to your Stacks private key hex.');
  process.exit(1);
}

// Create a Stacks account from the private key
const account = privateKeyToAccount(PRIVATE_KEY, 'testnet');
console.log(`Agent wallet: ${account.address}`);
console.log(`API:          ${API_BASE}\n`);

// Wrap axios with automatic x402 payment handling.
// When the server returns 402, the client:
//   1. Reads the payment-required header
//   2. Signs an STX transfer (does NOT broadcast yet)
//   3. Retries with payment-signature header
// The server then broadcasts and confirms the tx itself.
const api = createPaymentClient(account, { baseURL: API_BASE });

const query = {
  schema_version: '1.0',
  error: {
    message: 'sed: extra characters at the end of d command',
    type: 'process_exit',
    exit_code: 1,
  },
  environment: {
    os: { family: 'linux', distro: 'alpine' },
  },
  agent: {
    id: account.address,
    urgency: 'urgent' as const,
  },
};

try {
  console.log('Sending query to POST /solve...');
  console.log('(If the server returns 402, the x402 client will pay automatically)\n');

  const response = await api.post('/solve', query, {
    headers: { 'X-Agent-Id': account.address },
  });

  console.log('=== Solution received ===');
  console.log(`Title:        ${response.data.solution.title}`);
  console.log(`Solution ID:  ${response.data.solution.solution_id}`);
  console.log(`Success rate: ${(response.data.solution.success_rate * 100).toFixed(1)}%`);
  console.log(`\nPayment:`);
  console.log(`  Tx hash:  ${response.data.payment_receipt.tx_hash}`);
  console.log(`  Payer:    ${response.data.payment_receipt.payer}`);
  console.log(`  Currency: ${response.data.payment_receipt.currency}`);
  console.log(`  Network:  ${response.data.payment_receipt.network}`);
  console.log(`\nFirst step: ${response.data.solution.steps?.[0]?.instruction ?? 'N/A'}`);
} catch (err: any) {
  if (axios.isAxiosError(err)) {
    console.error('Request failed:', err.response?.status, JSON.stringify(err.response?.data, null, 2));
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
}
