"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const agentQuery_1 = require("../schemas/agentQuery");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const FeedbackSchema = zod_1.z.object({
    solution_id: zod_1.z.string(),
    payment_id: zod_1.z.string().optional(),
    outcome: agentQuery_1.OutcomeEnum,
    verification: zod_1.z.object({
        command_run: zod_1.z.string().optional(),
        output: zod_1.z.string().optional(),
        exit_code: zod_1.z.number().int().optional(),
    }).optional(),
    time_to_apply_seconds: zod_1.z.number().optional(),
    applied_without_modification: zod_1.z.boolean().optional(),
    environment_matched: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().optional(),
});
/**
 * POST /feedback
 * Always called by the agent after applying a solution. Free — powers quality rankings.
 */
router.post('/', auth_1.requireAgentId, async (req, res) => {
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
        }
        else if (outcome === 'partial') {
            newRate = totalUses > 0 ? (currentRate * totalUses + 0.5) / (totalUses + 1) : 0.5;
        }
        else if (outcome === 'failed' || outcome === 'not_applicable') {
            newRate = totalUses > 0 ? (currentRate * totalUses) / (totalUses + 1) : 0.0;
        }
        await prisma.solution.update({
            where: { id: solution_id },
            data: { successRate: Math.max(0, Math.min(1, newRate)) },
        });
        return res.json({
            recorded: true,
            outcome,
            message: outcome === 'resolved'
                ? 'Thank you. This improves the solution ranking and author score.'
                : 'Feedback recorded. This will be reviewed for quality.',
            solution_new_success_rate: parseFloat(newRate.toFixed(2)),
        });
    }
    catch (err) {
        console.error('[POST /feedback] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
exports.default = router;
