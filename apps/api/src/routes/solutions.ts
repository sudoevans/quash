import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAgentId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /solutions
 * Registry — returns all solutions, no payment required, no q required.
 * Optional filters: q (search), stack (comma-separated), limit (max 50).
 * Used by the resolver dashboard "Solutions" registry tab.
 */
router.get('/', async (req: Request, res: Response) => {
  const { q, stack, limit = '20' } = req.query;
  const maxLimit = Math.min(parseInt(limit as string, 10) || 20, 50);
  const stackDomains = stack ? (stack as string).split(',').map(s => s.trim()) : [];

  const where: any = {};
  if (q) {
    const keywords = (q as string).split(' ').filter(Boolean);
    where.AND = [
      {
        OR: [
          ...keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } })),
          ...keywords.map(kw => ({ problemSignatures: { has: kw } })),
        ],
      },
      ...(stackDomains.length > 0 ? [{ affectedStacks: { hasSome: stackDomains } }] : []),
    ];
  } else if (stackDomains.length > 0) {
    where.affectedStacks = { hasSome: stackDomains };
  }

  try {
    const solutions = await prisma.solution.findMany({
      where,
      take: maxLimit,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true, email: true } } },
    });

    return res.json({
      results: solutions.map(s => ({
        solution_id: s.id,
        title: s.title,
        author: s.author?.name ?? s.author?.email ?? 'Anonymous',
        problem_signatures: s.problemSignatures,
        affected_stacks: s.affectedStacks,
        success_rate: s.successRate,
        total_uses: s.totalUses,
        price_usdc: s.priceUsdc,
        created_at: s.createdAt,
      })),
      total: solutions.length,
    });
  } catch (err) {
    console.error('[GET /solutions] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

/**
 * GET /solutions/earnings?stacksAddress=ST...  (or ?email=...)
 * Returns all solutions authored by a given resolver + payment counts.
 * Accepts stacksAddress (wallet auth) or email (legacy fallback).
 */
router.get('/earnings', async (req: Request, res: Response) => {
  const { stacksAddress, email } = req.query;
  if (!stacksAddress && !email) {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'stacksAddress or email query parameter is required.' } });
  }

  try {
    const user = stacksAddress
      ? await prisma.user.findUnique({ where: { stacksAddress: stacksAddress as string } })
      : await prisma.user.findUnique({ where: { email: email as string } });
    if (!user) {
      return res.json({ solutions: [], total_earned_usdc: '0.00', total_uses: 0 });
    }

    const solutions = await prisma.solution.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        problems: { select: { id: true, status: true } },
      },
    });

    // Count confirmed payments per solution
    const paymentCounts = await Promise.all(
      solutions.map(s =>
        prisma.payment.count({ where: { solutionId: s.id, status: 'confirmed' } })
      )
    );

    const rows = solutions.map((s, i) => {
      const paid = paymentCounts[i];
      // Pending = problems linked to this solution that are solution_ready but not yet paid
      const pending = s.problems.filter(p => p.status === 'solution_ready').length - paid;
      const pendingCount = Math.max(0, pending);
      const price = parseFloat(s.priceUsdc);
      const earned = (price * paid).toFixed(4);
      const pendingUsdc = (price * pendingCount).toFixed(4);
      return {
        solution_id: s.id,
        title: s.title,
        problem_signatures: s.problemSignatures,
        affected_stacks: s.affectedStacks,
        success_rate: s.successRate,
        total_uses: s.totalUses,
        paid_unlocks: paid,
        pending_unlocks: pendingCount,
        price_usdc: s.priceUsdc,
        earned_usdc: earned,
        pending_usdc: pendingUsdc,
        created_at: s.createdAt,
      };
    });

    const totalEarned = rows.reduce((sum, r) => sum + parseFloat(r.earned_usdc), 0).toFixed(4);
    const totalPending = rows.reduce((sum, r) => sum + parseFloat(r.pending_usdc), 0).toFixed(4);
    const totalUses = rows.reduce((sum, r) => sum + r.total_uses, 0);

    return res.json({ solutions: rows, total_earned_usdc: totalEarned, total_pending_usdc: totalPending, total_uses: totalUses });
  } catch (err) {
    console.error('[GET /solutions/earnings] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

/**
 * GET /solutions/search
 * Free — no payment required. Always the first call an agent makes.
 * Query params: q, stack, error_type, limit
 */
router.get('/search', async (req: Request, res: Response) => {
  const { q, stack, error_type, limit = '5' } = req.query;

  if (!q) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'q query parameter is required.' },
    });
  }

  const keywords = (q as string).split(' ').filter(Boolean);
  const stackDomains = stack ? (stack as string).split(',').map(s => s.trim()) : [];
  const maxLimit = Math.min(parseInt(limit as string, 10) || 5, 20);

  const start = Date.now();

  try {
    const solutions = await prisma.solution.findMany({
      where: {
        AND: [
          // Match any keyword in title or problem signatures
          {
            OR: [
              ...keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } })),
              ...keywords.map(kw => ({ problemSignatures: { has: kw } })),
            ],
          },
          // Optional stack domain filter
          ...(stackDomains.length > 0
            ? [{ affectedStacks: { hasSome: stackDomains } }]
            : []),
        ],
      },
      take: maxLimit,
      orderBy: { successRate: 'desc' },
    });

    const queryTimeMs = Date.now() - start;

    if (solutions.length === 0) {
      return res.json({
        results: [],
        total: 0,
        query_time_ms: queryTimeMs,
        suggestion: 'No solutions found. You can post this problem as a live bounty via POST /problems.',
      });
    }

    return res.json({
      results: solutions.map(s => ({
        solution_id: s.id,
        title: s.title,
        problem_signatures: s.problemSignatures,
        affected_stacks: s.affectedStacks,
        success_rate: s.successRate,
        total_uses: s.totalUses,
        price_usdc: s.priceUsdc,
        author_tier: null, // tier system is Phase 2
        created_at: s.createdAt,
      })),
      total: solutions.length,
      query_time_ms: queryTimeMs,
    });
  } catch (err) {
    console.error('[GET /solutions/search] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

/**
 * GET /solutions/:id
 * Retrieve a previously purchased solution without paying again.
 * Agent must have a confirmed payment record for this solution.
 */
router.get('/:id', requireAgentId, async (req: Request, res: Response) => {
  const { id } = req.params;
  const agentId = (req as any).agentId as string;

  try {
    const solution = await prisma.solution.findUnique({ where: { id } });
    if (!solution) {
      return res.status(404).json({ error: { code: 'SOLUTION_NOT_FOUND', message: 'Solution not found.' } });
    }

    // Verify the agent has paid for this solution
    const agent = await prisma.agent.findUnique({ where: { agentString: agentId } });
    if (!agent) {
      return res.status(402).json({
        error: { code: 'PAYMENT_REQUIRED', message: 'No payment record found. Call POST /solve to purchase this solution.' },
      });
    }

    const payment = await prisma.payment.findFirst({
      where: { agentId: agent.id, solutionId: id, status: 'confirmed' },
    });

    if (!payment) {
      return res.status(402).json({
        error: { code: 'PAYMENT_REQUIRED', message: 'No payment record found. Call POST /solve to purchase this solution.' },
      });
    }

    const fixData = JSON.parse(solution.structuredFixJson);

    return res.json({
      solution: {
        solution_id: solution.id,
        schema_version: '1.2',
        title: solution.title,
        problem_signatures: solution.problemSignatures,
        affected_stacks: solution.affectedStacks,
        success_rate: solution.successRate,
        total_uses: solution.totalUses,
        price_usdc: solution.priceUsdc,
        ...fixData,
      },
      payment_receipt: {
        payment_id: payment.id,
        tx_hash: payment.txHash,
        amount_paid: solution.priceUsdc,
        currency: payment.currency,
        network: payment.network,
        confirmed_at: payment.createdAt,
      },
    });
  } catch (err) {
    console.error('[GET /solutions/:id] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

export default router;
