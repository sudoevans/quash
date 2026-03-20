import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AgentQuerySchema } from '../schemas/agentQuery';
import { requireAgentId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// The Stacks wallet address of the platform treasury (recipient of solution payments)
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || 'SP2X4BFPQ3BYWKFV4M8XTMVF7YJ4DWM2PGXB4VBT';

/**
 * POST /solve
 *
 * Step A (no X-Payment header): Returns 402 with payment details.
 * Step B (X-Payment header present): Validates payment, returns full solution.
 */
router.post('/', requireAgentId, async (req: Request, res: Response) => {
  // Validate the body
  const parseResult = AgentQuerySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Schema validation failed.', details: parseResult.error.flatten() },
    });
  }

  const query = parseResult.data;

  // --- Step B: Payment header present ---
  const xPaymentHeader = req.headers['x-payment'];
  if (xPaymentHeader) {
    let paymentData: any;
    try {
      paymentData = typeof xPaymentHeader === 'string' ? JSON.parse(xPaymentHeader) : xPaymentHeader;
    } catch {
      return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'X-Payment header is not valid JSON.' } });
    }

    const { txid, solution_id } = paymentData;
    if (!txid || !solution_id) {
      return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'X-Payment must include txid and solution_id.' } });
    }

    try {
      const solution = await prisma.solution.findUnique({ where: { id: solution_id } });
      if (!solution) {
        return res.status(404).json({ error: { code: 'SOLUTION_NOT_FOUND', message: 'Solution not found.' } });
      }

      // Record the payment (idempotent by txid unique constraint)
      let payment;
      try {
        payment = await prisma.payment.create({
          data: {
            txHash: txid,
            agentId: (req as any).agentId,
            solutionId: solution_id,
            amountMicro: Math.round(parseFloat(solution.priceUsdc) * 1_000_000),
            status: 'confirmed',
          },
        });
      } catch (dupErr: any) {
        // If unique constraint error, payment already recorded — still serve the solution
        payment = await prisma.payment.findUnique({ where: { txHash: txid } });
      }

      // Increment usage counter
      await prisma.solution.update({
        where: { id: solution_id },
        data: { totalUses: { increment: 1 } },
      });

      const fixData = JSON.parse(solution.structuredFixJson);

      return res.json({
        solution: {
          solution_id: solution.id,
          schema_version: '1.2',
          title: solution.title,
          success_rate: solution.successRate,
          total_uses: solution.totalUses + 1,
          price_usdc: solution.priceUsdc,
          ...fixData,
        },
        payment_receipt: {
          payment_id: payment?.id,
          tx_hash: txid,
          amount_paid: solution.priceUsdc,
          currency: 'USDCx',
          network: process.env.STACKS_NETWORK === 'mainnet' ? 'stacks:mainnet' : 'stacks:testnet',
          confirmed_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[POST /solve] Step B error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unlock solution.' } });
    }
  }

  // --- Step A: No payment header — find best match and return 402 ---
  try {
    const keywords = query.error.message.split(' ').slice(0, 6);

    const solution = await prisma.solution.findFirst({
      where: {
        OR: keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } })),
      },
      orderBy: { successRate: 'desc' },
    });

    if (!solution) {
      // No solution found - instruct to post a live bounty
      const liveId = `lq_${Date.now()}`;
      return res.status(404).json({
        matched: false,
        live_question_id: liveId,
        message: 'No solution found for this error. Post it as a live bounty and a domain expert will solve it.',
        suggestion: `POST /problems with this live_question_id to offer a bounty`,
      });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes

    return res.status(402).json({
      solution_id: solution.id,
      title: solution.title,
      preview: {
        first_step: 'See full solution after payment.',
      },
      success_rate: solution.successRate,
      total_uses: solution.totalUses,
      payment: {
        scheme: 'exact',
        network: process.env.STACKS_NETWORK === 'mainnet' ? 'stacks:mainnet' : 'stacks:testnet',
        currency: 'USDCx',
        amount: solution.priceUsdc,
        payTo: PLATFORM_WALLET,
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error('[POST /solve] Step A error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

export default router;
