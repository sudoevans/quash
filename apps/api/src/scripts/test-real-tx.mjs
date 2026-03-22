/**
 * Makes a real lock-stx call on the quash-escrow testnet contract.
 * Run with: node src/scripts/test-real-tx.mjs
 */
import {
  makeContractCall,
  broadcastTransaction,
  stringAsciiCV,
  principalCV,
  uintCV,
  AnchorMode,
  PostConditionMode,
  makeStandardSTXPostCondition,
  FungibleConditionCode,
} from '@stacks/transactions';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { STACKS_TESTNET } from '@stacks/network';

const MNEMONIC = 'nephew wash tissue exchange you boil front mountain when correct resource pill suspect elder wink subject drop spend tree elbow hungry clay veteran congress';
const CONTRACT_ADDRESS = 'ST2MH65RCF2W7GA8ZEVM0V3V55XT97Y9BHM5RN9TE';
const CONTRACT_NAME = 'quash-escrow';
const SOLUTION_ID = 'seed-sol-001';
const AMOUNT_MICRO = 30_000n; // 0.03 STX = $0.03 at 1 STX = $1

const wallet = await generateWallet({ secretKey: MNEMONIC, password: '' });
const account = wallet.accounts[0];
const senderAddress = getStxAddress({ account, transactionVersion: 0x80 }); // testnet
const senderKey = account.stxPrivateKey;

console.log('Sender:', senderAddress);
console.log(`Calling ${CONTRACT_ADDRESS}.${CONTRACT_NAME}::lock-stx`);
console.log(`  solution-id: "${SOLUTION_ID}"`);
console.log(`  author: ${senderAddress} (self, for test)`);
console.log(`  amount: ${AMOUNT_MICRO} microSTX`);

const tx = await makeContractCall({
  contractAddress: CONTRACT_ADDRESS,
  contractName: CONTRACT_NAME,
  functionName: 'lock-stx',
  functionArgs: [
    stringAsciiCV(SOLUTION_ID),
    principalCV(senderAddress), // author = self for this test
    uintCV(AMOUNT_MICRO),
  ],
  senderKey,
  network: STACKS_TESTNET,
  anchorMode: AnchorMode.OnChainOnly,
  postConditionMode: PostConditionMode.Deny,
  postConditions: [
    makeStandardSTXPostCondition(
      senderAddress,
      FungibleConditionCode.Equal,
      AMOUNT_MICRO,
    ),
  ],
  fee: 2000n,
});

const result = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });
console.log('\nResult:', JSON.stringify(result, null, 2));

if (result.txid) {
  const txid = result.txid;
  console.log(`\nTxid: ${txid}`);
  console.log(`Explorer: https://explorer.hiro.so/txid/${txid}?chain=testnet`);
  console.log('\nWaiting ~30s for confirmation, then testing Step B...');
  await new Promise(r => setTimeout(r, 35_000));

  const stepB = await fetch('http://localhost:4000/solve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': senderAddress,
      'X-Payment': JSON.stringify({ txid, solution_id: SOLUTION_ID, currency: 'STX' }),
    },
    body: JSON.stringify({
      schema_version: '1.0',
      error: { message: 'sed: extra characters', type: 'process_exit', exit_code: 1 },
      environment: { os: { family: 'linux', distro: 'alpine' } },
      agent: { id: senderAddress, urgency: 'urgent' },
    }),
  });
  const data = await stepB.json();
  console.log('\nStep B response:', JSON.stringify(data, null, 2));
}
