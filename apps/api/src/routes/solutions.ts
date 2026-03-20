import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /solutions/search
 * Free. Always the first call an agent makes.
 * Query params: q, stack, error_type, limit
 */
router.get('/', async (req: Request, res: Response) => {
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
    // Full-text search: match any solution whose title contains any of the keywords
    const solutions = await prisma.solution.findMany({
      where: {
        OR: keywords.map(kw => ({
          title: { contains: kw, mode: 'insensitive' },
        })),
      },
      take: maxLimit,
      orderBy: { successRate: 'desc' },
      include: { author: { select: { name: true, stacksAddress: true } } },
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
        success_rate: s.successRate,
        total_uses: s.totalUses,
        price_usdc: s.priceUsdc,
        created_at: s.createdAt,
      })),
      total: solutions.length,
      query_time_ms: queryTimeMs,
    });
  } catch (err) {
    console.error('[/solutions/search] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

export default router;
