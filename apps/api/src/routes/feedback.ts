import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAgentId } from '../middleware/auth';
import { z } from 'zod';
import { OutcomeEnum } from '../schemas/agentQuery';

const router = Router();
const prisma = new PrismaClient();

const FeedbackSchema = z.object({
  solution_id: z.string(),
  payment_id: z.string().optional(),
  outcome: OutcomeEnum,
  verification: z.object({
    command_run: z.string().optional(),
    output: z.string().optional(),
    exit_code: z.number().int().optional(),
  }).optional(),
  time_to_apply_seconds: z.number().optional(),
  applied_without_modification: z.boolean().optional(),
  environment_matched: z.boolean().optional(),
  notes: z.string().optional(),
});

/**
 * POST /feedback
 * Always called by the agent after applying a solution. Free — powers quality rankings.
 */
router.post('/', requireAgentId, async (req: Request, res: Response) => {
  const parseResult = FeedbackSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Schema validation failed.', details: parseResult.error.flatten() },
    });
  }

  const { solution_id, outcome } = parseResult.data;

  try {
    const solution = await prisma.solution.findUnique({ where: { id: solution_id } });
    if (!solution) {
      return res.status(404).json({ error: { code: 'SOLUTION_NOT_FOUND', message: 'Solution not found.' } });
    }

    // Recalculate rolling success rate
    const totalUses = solution.totalUses;
    const currentRate = solution.successRate;
    let newRate = currentRate;

    if (outcome === 'resolved') {
      newRate = totalUses > 0 ? (currentRate * totalUses + 1) / (totalUses + 1) : 1.0;
    } else if (outcome === 'partial') {
      newRate = totalUses > 0 ? (currentRate * totalUses + 0.5) / (totalUses + 1) : 0.5;
    } else if (outcome === 'failed' || outcome === 'not_applicable') {
      newRate = totalUses > 0 ? (currentRate * totalUses) / (totalUses + 1) : 0.0;
    }

    await prisma.solution.update({
      where: { id: solution_id },
      data: { successRate: Math.max(0, Math.min(1, newRate)) },
    });

    return res.json({
      recorded: true,
      outcome,
      message:
        outcome === 'resolved'
          ? 'Thank you. This improves the solution ranking and author score.'
          : 'Feedback recorded. This will be reviewed for quality.',
      solution_new_success_rate: parseFloat(newRate.toFixed(2)),
    });
  } catch (err) {
    console.error('[POST /feedback] Error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
  }
});

export default router;
