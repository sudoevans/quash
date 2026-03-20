import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyWebhookSignature } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /webhooks/payment
 * Sent by Hiro Chainhook when an on-chain payment transaction is confirmed.
 * Verifies HMAC-SHA256 signature, records payment, and unlocks the linked solution.
 */
router.post('/payment', verifyWebhookSignature, async (req: Request, res: Response) => {
  const {
    event,
    tx_hash,
    from_wallet,
    to_wallet,
    amount_micro,
    currency,
    confirmed_at,
    metadata,
  } = req.body;

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
    // Upsert agent
    await prisma.agent.upsert({
      where: { agentString: agent_id },
      create: { agentString: agent_id },
      update: { lastSeen: new Date() },
    });

    const agent = await prisma.agent.findUnique({ where: { agentString: agent_id } });
    if (!agent) throw new Error('Agent not found after upsert');

    // Record the confirmed on-chain payment (idempotent)
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

    // If there's an open problem waiting for this payment, mark it solution_ready
    await prisma.problem.updateMany({
      where: {
        agentId: agent.id,
        status: { in: ['open', 'claimed'] },
      },
      data: { status: 'solution_ready', solutionId: solution_id },
    });

    console.log(`[Chainhook] Payment confirmed: ${tx_hash} for solution ${solution_id}`);
    return res.json({ received: true, payment_id: payment.id });
  } catch (err: any) {
    // Unique constraint: already recorded, idempotent ok
    if (err.code === 'P2002') {
      return res.json({ received: true, note: 'Already recorded.' });
    }
    console.error('[POST /webhooks/payment] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to process webhook.' } });
  }
});

export default router;
