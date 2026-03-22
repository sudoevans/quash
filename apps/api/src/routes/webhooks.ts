import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyWebhookSignature } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const PLATFORM_WALLET = (process.env.PLATFORM_WALLET_ADDRESS ?? '').toLowerCase();

/**
 * POST /webhooks/payment
 *
 * Receives events from Hiro Chainhook (Wallet Activity on platform wallet).
 * Chainhook wraps confirmed transactions in an { apply: [...] } envelope.
 *
 * Also accepts the legacy flat format for testing:
 *   { event, tx_hash, metadata: { solution_id, agent_id } }
 */
router.post('/payment', verifyWebhookSignature, async (req: Request, res: Response) => {
  const body = req.body;

  // ── Chainhook native format ──────────────────────────────────────────────
  if (Array.isArray(body.apply)) {
    const results: string[] = [];

    for (const block of body.apply) {
      for (const tx of block.transactions ?? []) {
        const txHash: string = tx.transaction_identifier?.hash ?? '';
        if (!txHash) continue;

        const events: any[]  = tx.metadata?.receipt?.events ?? tx.events ?? [];
        const metadata: any  = tx.metadata ?? {};

        // For Contract Events (quash-escrow.lock-stx):
        // Extract solution-id from the print event emitted by lock-stx.
        // The print tuple has shape: { event: "lock-stx", solution-id: "...", agent: principal, amount: uint }
        let solutionIdFromContract: string | null = null;
        const printEvent = events.find(
          (e: any) =>
            e.event_type === 'smart_contract_log' &&
            typeof e.contract_log?.value === 'string' &&
            e.contract_log.value.includes('lock-stx')
        );
        if (printEvent) {
          // Hiro returns Clarity values as serialized strings like:
          // (tuple (event "lock-stx") (solution-id "seed-sol-001") ...)
          const match = printEvent.contract_log.value.match(/solution-id "([^"]+)"/);
          if (match) solutionIdFromContract = match[1];
        }

        // Also check function_args for solution-id (contract_call metadata)
        if (!solutionIdFromContract && metadata.kind?.data?.function_name === 'lock-stx') {
          const args: any[] = metadata.kind?.data?.function_args ?? [];
          const idArg = args.find((a: any) => a.name === 'solution-id');
          if (idArg?.repr) solutionIdFromContract = idArg.repr.replace(/^"|"$/g, '');
        }

        // For Wallet Activity events (legacy / direct transfers):
        const transferEvent = events.find(
          (e: any) =>
            e.event_type === 'fungible_token_asset' &&
            e.asset?.asset_event_type === 'transfer' &&
            e.asset?.recipient?.toLowerCase() === PLATFORM_WALLET
        );
        const amountMicro: number = transferEvent
          ? parseInt(transferEvent.asset?.amount ?? '0', 10)
          : 0;

        try {
          // Confirm any pending payment for this txHash (from Step B)
          const updated = await prisma.payment.updateMany({
            where: { txHash, status: 'pending' },
            data: { status: 'confirmed' },
          });

          // If contract gave us a solution-id, also confirm by solution-id match
          if (solutionIdFromContract && updated.count === 0) {
            await prisma.payment.updateMany({
              where: { solutionId: solutionIdFromContract, status: 'pending' },
              data: { status: 'confirmed', txHash },
            });
          }

          console.log(`[Chainhook] Contract event: tx=${txHash} solution=${solutionIdFromContract ?? 'unknown'} amount=${amountMicro}`);
          results.push(txHash);
        } catch (err) {
          console.error(`[Chainhook] Failed to process tx ${txHash}:`, err);
        }
      }
    }

    return res.json({ received: true, confirmed: results });
  }

  // ── Legacy flat format (used in tests + direct webhook calls) ────────────
  const { event, tx_hash, from_wallet, amount_micro, currency, confirmed_at, metadata } = body;

  if (event !== 'payment_confirmed') {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: `Unknown event: ${event}` } });
  }

  const { solution_id, agent_id } = metadata ?? {};
  if (!tx_hash || !solution_id || !agent_id) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Missing tx_hash, solution_id, or agent_id in metadata.' },
    });
  }

  try {
    await prisma.agent.upsert({
      where: { agentString: agent_id },
      create: { agentString: agent_id },
      update: { lastSeen: new Date() },
    });

    const agent = await prisma.agent.findUnique({ where: { agentString: agent_id } });
    if (!agent) throw new Error('Agent not found after upsert');

    const payment = await prisma.payment.upsert({
      where: { txHash: tx_hash },
      create: {
        txHash: tx_hash,
        agentId: agent.id,
        solutionId: solution_id,
        amountMicro: amount_micro ?? 0,
        currency: currency ?? 'USDCx',
        network: 'stacks:testnet',
        status: 'confirmed',
        createdAt: confirmed_at ? new Date(confirmed_at) : new Date(),
      },
      update: { status: 'confirmed' },
    });

    // Mark any open/claimed problem for this agent as solution_ready
    await prisma.problem.updateMany({
      where: { agentId: agent.id, status: { in: ['open', 'claimed'] } },
      data: { status: 'solution_ready', solutionId: solution_id },
    });

    console.log(`[Webhook] Payment confirmed: ${tx_hash} → solution ${solution_id}`);
    return res.json({ received: true, payment_id: payment.id });
  } catch (err: any) {
    if (err.code === 'P2002') return res.json({ received: true, note: 'Already recorded.' });
    console.error('[POST /webhooks/payment] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to process webhook.' } });
  }
});

export default router;
