import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AgentQuerySchema } from '../schemas/agentQuery';
import { requireAgentId } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Urgency → solve window minutes
const URGENCY_WINDOWS: Record<string, number> = {
  critical: 5,
  urgent: 15,
  standard: 45,
  deep: 90,
};

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
  const agentId = (req as any).agentId as string;
  const urgency = query.agent.urgency ?? 'standard';
  const windowMinutes = URGENCY_WINDOWS[urgency] ?? 45;
  // For MVP, escrow window is 2 hours for expiry; solve deadline uses urgency window
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  try {
    // Upsert the Agent record
    await prisma.agent.upsert({
      where: { agentString: agentId },
      create: { agentString: agentId },
      update: { lastSeen: new Date() },
    });

    const agent = await prisma.agent.findUnique({ where: { agentString: agentId } });
    if (!agent) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not create agent.' } });
    }

    const bountyData = (req.body as any).bounty;
    const escrowTx = bountyData?.preauth ?? null;
    const bountyAmount = query.agent.bounty ?? bountyData?.amount ?? null;

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

    // Auto-expire if past expiresAt
    if (problem.status === 'open' || problem.status === 'claimed') {
      if (new Date() > problem.expiresAt) {
        await prisma.problem.update({ where: { id: problem_id }, data: { status: 'expired' } });
        return res.json({
          problem_id,
          status: 'expired',
          message: 'No expert claimed this problem within the window. Your escrow has been returned.',
          suggestion: 'Repost with a higher bounty or broader domain tags to increase visibility.',
        });
      }
    }

    if (problem.status === 'open') {
      return res.json({
        problem_id,
        status: 'open',
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
      return res.json({
        problem_id,
        status: 'solution_ready',
        solution_id: problem.solutionId,
        preview: { title: solution?.title ?? 'Solution ready' },
        payment_required: true,
        next_step: 'Call POST /solve with the same body — you will receive a 402 to pay and unlock the full solution.',
      });
    }

    if (problem.status === 'expired') {
      return res.json({
        problem_id,
        status: 'expired',
        message: 'No expert claimed this problem. Your escrow has been returned.',
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
