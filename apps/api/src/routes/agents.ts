import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAgentId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /agents/history
 * Returns the agent's payment history with solution titles and outcomes.
 * Auth: X-Agent-Id header (same as all agent routes).
 */
router.get('/history', requireAgentId, async (req: Request, res: Response) => {
  const agentId = (req as any).agentId as string;
  const days    = Math.min(parseInt((req.query.days as string) ?? '30', 10) || 30, 365);
  const cutoff  = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const agent = await prisma.agent.findUnique({ where: { agentString: agentId } });
    if (!agent) {
      return res.json({ history: [], total_stx_spent: '0', resolution_count: 0, days });
    }

    const payments = await prisma.payment.findMany({
      where: {
        agentId: agent.id,
        createdAt: { gte: cutoff },
        status: 'confirmed',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch solutions for all payments in one query
    const solutionIds = [...new Set(payments.map(p => p.solutionId))];
    const solutions = await prisma.solution.findMany({
      where: { id: { in: solutionIds } },
      select: { id: true, title: true, problemSignatures: true },
    });
    const solutionMap = new Map(solutions.map(s => [s.id, s]));

    const stxMicrosPerUnit = parseInt(process.env.STX_MICROS_PER_USD ?? '1000000', 10);

    const history = payments.map(p => {
      const sol = solutionMap.get(p.solutionId);
      const sig = sol?.problemSignatures?.[0] ?? sol?.title?.toLowerCase().replace(/\s+/g, '-').slice(0, 30) ?? '?';
      const amountStx = (p.amountMicro / stxMicrosPerUnit).toFixed(4);
      return {
        date:           p.createdAt.toISOString().slice(0, 10),
        signature:      sig,
        amount_stx:     amountStx,
        solution_title: sol?.title ?? null,
        payment_id:     p.id,
        outcome:        'unlocked',
      };
    });

    const totalMicro  = payments.reduce((sum, p) => sum + p.amountMicro, 0);
    const totalStx    = (totalMicro / stxMicrosPerUnit).toFixed(4);

    return res.json({
      history,
      total_stx_spent:   totalStx,
      resolution_count:  payments.length,
      days,
    });
  } catch (err) {
    console.error('[GET /agents/history] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

export default router;
