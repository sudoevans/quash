import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AgentQuerySchema } from '../schemas/agentQuery';
import { requireAgentId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const URGENCY_WINDOWS: Record<string, number> = {
  critical: 5,
  urgent: 15,
  standard: 45,
  deep: 90,
};

/** Fire-and-forget POST to agent's callback_url */
async function sendCallback(callbackUrl: string, payload: object) {
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn(`[callback] Failed to POST to ${callbackUrl}:`, (err as Error).message);
  }
}

/**
 * GET /problems
 * Resolvers fetch open problems to work on. Optionally filtered by status/urgency/domain.
 */
router.get('/', async (req: Request, res: Response) => {
  const { status, urgency, domain, limit = '50' } = req.query as Record<string, string>;

  try {
    const where: any = {};
    if (status) where.status = status;
    if (urgency) where.urgency = urgency;

    const problems = await prisma.problem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10), 100),
      select: {
        id: true,
        status: true,
        urgency: true,
        errorType: true,
        errorMessage: true,
        bountyAmount: true,
        createdAt: true,
        expiresAt: true,
        agent: { select: { agentString: true } },
      },
    });

    return res.json({
      problems: problems.map(p => ({
        id: p.id,
        status: p.status,
        urgency: p.urgency,
        errorType: p.errorType,
        errorMessage: p.errorMessage,
        bountyAmount: p.bountyAmount,
        agentId: p.agent?.agentString,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
      })),
      total: problems.length,
    });
  } catch (err) {
    console.error('[GET /problems] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

/**
 * POST /problems/:id/claim
 * Resolver claims a problem to work on.
 */
router.post('/:problem_id/claim', async (req: Request, res: Response) => {
  const { problem_id } = req.params;
  try {
    const problem = await prisma.problem.findUnique({ where: { id: problem_id } });
    if (!problem) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem not found.' } });
    if (problem.status !== 'open') return res.status(409).json({ error: { code: 'CONFLICT', message: `Problem is already ${problem.status}.` } });

    const solveDeadline = new Date(Date.now() + (URGENCY_WINDOWS[problem.urgency] ?? 45) * 60 * 1000);
    await prisma.problem.update({
      where: { id: problem_id },
      data: { status: 'claimed', solveDeadline },
    });

    return res.json({ problem_id, status: 'claimed', solve_deadline: solveDeadline.toISOString() });
  } catch (err) {
    console.error('[POST /problems/:id/claim] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

/**
 * POST /problems
 * Agent posts a live bounty when no solution exists. Funds locked in escrow upfront.
 */
router.post('/', requireAgentId, async (req: Request, res: Response) => {
  const parseResult = AgentQuerySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Schema validation failed.', details: parseResult.error.flatten() },
    });
  }

  const query = parseResult.data;
  const agentIdString = (req as any).agentId as string;
  const urgency = query.agent.urgency ?? 'standard';
  const windowMinutes = URGENCY_WINDOWS[urgency] ?? 45;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2-hour escrow window

  try {
    await prisma.agent.upsert({
      where: { agentString: agentIdString },
      create: { agentString: agentIdString },
      update: { lastSeen: new Date() },
    });

    const agent = await prisma.agent.findUnique({ where: { agentString: agentIdString } });
    if (!agent) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not create agent.' } });
    }

    const bountyData = (req.body as any).bounty;
    const escrowTx = bountyData?.preauth ?? null;
    const bountyAmount = query.agent.bounty != null ? String(query.agent.bounty) : bountyData?.amount != null ? String(bountyData.amount) : null;
    const callbackUrl = (req.body as any).callback_url ?? null;

    const problem = await prisma.problem.create({
      data: {
        agentId: agent.id,
        status: 'open',
        errorType: query.error.type,
        errorMessage: query.error.message,
        fullQueryJson: JSON.stringify(query),
        escrowTx,
        bountyAmount,
        urgency,
        callbackUrl,
        expiresAt,
      },
    });

    return res.status(202).json({
      problem_id: problem.id,
      status: 'open',
      bounty_locked: !!escrowTx,
      escrow_tx: escrowTx,
      poll_url: `/problems/${problem.id}/status`,
      poll_interval_seconds: 30,
      estimated_response: `${windowMinutes} min`,
      expires_at: expiresAt.toISOString(),
      message: 'Problem posted. Funds locked. An expert in your domain will be notified immediately.',
    });
  } catch (err) {
    console.error('[POST /problems] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to post problem.' } });
  }
});

/**
 * GET /problems/:problem_id/status
 * Agent polls every 30s. Returns open / claimed / solution_ready / expired.
 */
router.get('/:problem_id/status', requireAgentId, async (req: Request, res: Response) => {
  const { problem_id } = req.params;

  try {
    const problem = await prisma.problem.findUnique({ where: { id: problem_id } });
    if (!problem) {
      return res.status(404).json({ error: { code: 'PROBLEM_NOT_FOUND', message: 'Problem not found.' } });
    }

    // Auto-expire if past expiresAt and still active
    if ((problem.status === 'open' || problem.status === 'claimed') && new Date() > problem.expiresAt) {
      await prisma.problem.update({ where: { id: problem_id }, data: { status: 'expired' } });

      if (problem.callbackUrl) {
        sendCallback(problem.callbackUrl, {
          event: 'expired',
          problem_id,
          message: 'No expert claimed your problem. Escrow returned.',
          escrow_returned_tx: problem.escrowTx ?? null,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        problem_id,
        status: 'expired',
        message: 'No expert claimed this problem within the window. Your escrow has been returned.',
        escrow_returned_tx: problem.escrowTx ?? null,
        suggestion: 'Repost with a higher bounty or broader domain tags to increase visibility.',
      });
    }

    if (problem.status === 'open') {
      return res.json({
        problem_id,
        status: 'open',
        queued_agents: problem.queuedAgents,
        estimated_response: '5–15 min',
        expires_at: problem.expiresAt.toISOString(),
      });
    }

    if (problem.status === 'claimed') {
      return res.json({
        problem_id,
        status: 'claimed',
        message: 'An expert is working on your problem.',
        solve_deadline: problem.solveDeadline?.toISOString(),
        urgency_window_minutes: URGENCY_WINDOWS[problem.urgency] ?? 45,
      });
    }

    if (problem.status === 'solution_ready' && problem.solutionId) {
      const solution = await prisma.solution.findUnique({ where: { id: problem.solutionId } });
      let firstStep = 'See full solution after payment.';
      try {
        const fixData = JSON.parse(solution?.structuredFixJson ?? '{}');
        if (Array.isArray(fixData.steps) && fixData.steps.length > 0) {
          firstStep = fixData.steps[0].instruction ?? firstStep;
        }
      } catch { /* use default */ }

      return res.json({
        problem_id,
        status: 'solution_ready',
        solution_id: problem.solutionId,
        preview: {
          title: solution?.title ?? 'Solution ready',
          first_step: firstStep,
        },
        payment_required: true,
        next_step: 'Call POST /solve with the same body — you will receive a 402 to pay and unlock the full solution.',
      });
    }

    if (problem.status === 'expired') {
      return res.json({
        problem_id,
        status: 'expired',
        message: 'No expert claimed this problem. Your escrow has been returned.',
        escrow_returned_tx: problem.escrowTx ?? null,
        suggestion: 'Repost with a higher bounty or broader domain tags to increase visibility.',
      });
    }

    return res.json({ problem_id, status: problem.status });
  } catch (err) {
    console.error('[GET /problems/:id/status] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

export default router;
