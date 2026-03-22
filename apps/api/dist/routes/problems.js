"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const agentQuery_1 = require("../schemas/agentQuery");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const URGENCY_WINDOWS = {
    critical: 5,
    urgent: 15,
    standard: 45,
    deep: 90,
};
/** Fire-and-forget POST to agent's callback_url */
async function sendCallback(callbackUrl, payload) {
    try {
        await fetch(callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
        });
    }
    catch (err) {
        console.warn(`[callback] Failed to POST to ${callbackUrl}:`, err.message);
    }
}
/**
 * GET /problems
 * Resolvers fetch open problems to work on. Optionally filtered by status/urgency/domain.
 */
router.get('/', async (req, res) => {
    const { status, urgency, domain, limit = '50' } = req.query;
    try {
        const where = {};
        if (status)
            where.status = status;
        if (urgency)
            where.urgency = urgency;
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
    }
    catch (err) {
        console.error('[GET /problems] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * GET /problems/:problem_id
 * Public — resolvers fetch full problem details before writing a solution.
 */
router.get('/:problem_id', async (req, res) => {
    const { problem_id } = req.params;
    try {
        const problem = await prisma.problem.findUnique({
            where: { id: problem_id },
            select: {
                id: true,
                status: true,
                urgency: true,
                errorType: true,
                errorMessage: true,
                fullQueryJson: true,
                bountyAmount: true,
                createdAt: true,
                expiresAt: true,
                solveDeadline: true,
                agent: { select: { agentString: true } },
            },
        });
        if (!problem) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem not found.' } });
        }
        let environment = null;
        try {
            const q = JSON.parse(problem.fullQueryJson);
            environment = q?.environment ?? null;
        }
        catch { /* ignore */ }
        return res.json({
            id: problem.id,
            status: problem.status,
            urgency: problem.urgency,
            errorType: problem.errorType,
            errorMessage: problem.errorMessage,
            bountyAmount: problem.bountyAmount,
            agentId: problem.agent?.agentString,
            environment,
            createdAt: problem.createdAt.toISOString(),
            expiresAt: problem.expiresAt.toISOString(),
            solveDeadline: problem.solveDeadline?.toISOString() ?? null,
        });
    }
    catch (err) {
        console.error('[GET /problems/:id] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * POST /problems/:id/claim
 * Resolver claims a problem to work on.
 */
router.post('/:problem_id/claim', async (req, res) => {
    const { problem_id } = req.params;
    try {
        const problem = await prisma.problem.findUnique({ where: { id: problem_id } });
        if (!problem)
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem not found.' } });
        if (problem.status !== 'open')
            return res.status(409).json({ error: { code: 'CONFLICT', message: `Problem is already ${problem.status}.` } });
        const solveDeadline = new Date(Date.now() + (URGENCY_WINDOWS[problem.urgency] ?? 45) * 60 * 1000);
        await prisma.problem.update({
            where: { id: problem_id },
            data: { status: 'claimed', solveDeadline },
        });
        return res.json({ problem_id, status: 'claimed', solve_deadline: solveDeadline.toISOString() });
    }
    catch (err) {
        console.error('[POST /problems/:id/claim] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * POST /problems
 * Agent posts a live bounty when no solution exists. Funds locked in escrow upfront.
 */
router.post('/', auth_1.requireAgentId, async (req, res) => {
    const parseResult = agentQuery_1.AgentQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'Schema validation failed.', details: parseResult.error.flatten() },
        });
    }
    const query = parseResult.data;
    const agentIdString = req.agentId;
    const agentField = query.agent;
    const urgency = agentField.urgency ?? 'standard';
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
        const bountyData = req.body.bounty;
        const escrowTx = bountyData?.preauth ?? null;
        const bountyAmount = agentField.bounty != null ? String(agentField.bounty) : bountyData?.amount != null ? String(bountyData.amount) : null;
        const callbackUrl = req.body.callback_url ?? null;
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
    }
    catch (err) {
        console.error('[POST /problems] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to post problem.' } });
    }
});
/**
 * GET /problems/:problem_id/status
 * Agent polls every 30s. Returns open / claimed / solution_ready / expired.
 */
router.get('/:problem_id/status', auth_1.requireAgentId, async (req, res) => {
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
            }
            catch { /* use default */ }
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
    }
    catch (err) {
        console.error('[GET /problems/:id/status] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * POST /problems/:problem_id/solve
 * Human resolver submits a solution. Creates a Solution record, marks problem
 * as solution_ready, and fires the agent's callback_url if set.
 */
router.post('/:problem_id/solve', async (req, res) => {
    const { problem_id } = req.params;
    const { title, explanation, steps = [], code_patch, verification_command, verification_expected_output, author_confirmed_env, failure_modes = [], written_from = 'personal_experience', resolver_address, resolver_email, resolver_name, problem_signatures = [], affected_stacks = [], } = req.body;
    if (!title || !explanation) {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'title and explanation are required.' },
        });
    }
    try {
        const problem = await prisma.problem.findUnique({ where: { id: problem_id } });
        if (!problem) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem not found.' } });
        }
        if (problem.status === 'solution_ready' || problem.status === 'solved') {
            return res.status(409).json({ error: { code: 'CONFLICT', message: 'Problem already has a solution.' } });
        }
        // Upsert resolver as a User — prefer stacksAddress (wallet auth), fall back to email
        let resolver;
        if (resolver_address) {
            resolver = await prisma.user.upsert({
                where: { stacksAddress: resolver_address },
                create: { stacksAddress: resolver_address, name: resolver_name ?? 'Anonymous Resolver', email: resolver_email ?? null },
                update: {},
            });
        }
        else {
            const email = resolver_email ?? 'anonymous@quash.io';
            resolver = await prisma.user.upsert({
                where: { email },
                create: { email, name: resolver_name ?? 'Anonymous Resolver' },
                update: {},
            });
        }
        // Build structured fix blob
        const structuredFixJson = JSON.stringify({
            explanation,
            steps,
            code_patch: code_patch ?? null,
            verification_command: verification_command ?? null,
            verification_expected_output: verification_expected_output ?? null,
            author_confirmed_env: author_confirmed_env ?? null,
            failure_modes,
            written_from,
        });
        // Derive signatures from error type if not provided
        const signatures = problem_signatures.length > 0
            ? problem_signatures
            : [problem.errorType.toLowerCase().replace(/[^a-z0-9]+/g, '-')];
        // Derive affected stacks from the original agent query if not provided
        let stacks = affected_stacks.length > 0 ? affected_stacks : [];
        if (stacks.length === 0) {
            try {
                const queryData = JSON.parse(problem.fullQueryJson);
                const distro = queryData?.environment?.os?.distro;
                const family = queryData?.environment?.os?.family;
                if (distro)
                    stacks.push(distro);
                if (family && family !== distro)
                    stacks.push(family);
            }
            catch { /* use empty */ }
        }
        const solution = await prisma.solution.create({
            data: {
                title,
                authorId: resolver.id,
                structuredFixJson,
                problemSignatures: signatures,
                affectedStacks: stacks,
                successRate: 0.0,
                totalUses: 0,
                // Use the problem's locked bounty as the payout amount (in STX)
                priceUsdc: problem.bountyAmount ?? '0',
            },
        });
        await prisma.problem.update({
            where: { id: problem_id },
            data: { status: 'solution_ready', solutionId: solution.id },
        });
        // Notify agent callback
        if (problem.callbackUrl) {
            sendCallback(problem.callbackUrl, {
                event: 'solution_ready',
                problem_id,
                solution_id: solution.id,
                title: solution.title,
                message: 'A human expert has resolved your problem. Call POST /solve to unlock the full solution.',
                timestamp: new Date().toISOString(),
            });
        }
        return res.status(201).json({
            solution_id: solution.id,
            problem_id,
            status: 'solution_ready',
            message: 'Solution submitted. The agent has been notified and can now unlock it via POST /solve.',
        });
    }
    catch (err) {
        console.error('[POST /problems/:id/solve] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to submit solution.' } });
    }
});
exports.default = router;
