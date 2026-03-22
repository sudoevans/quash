"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
/**
 * GET /solutions
 * Registry — returns all solutions, no payment required, no q required.
 * Optional filters: q (search), stack (comma-separated), limit (max 50).
 * Used by the resolver dashboard "Solutions" registry tab.
 */
router.get('/', async (req, res) => {
    const { q, stack, limit = '20' } = req.query;
    const maxLimit = Math.min(parseInt(limit, 10) || 20, 50);
    const stackDomains = stack ? stack.split(',').map(s => s.trim()) : [];
    const where = {};
    if (q) {
        const keywords = q.split(' ').filter(Boolean);
        where.AND = [
            {
                OR: [
                    ...keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' } })),
                    ...keywords.map(kw => ({ problemSignatures: { has: kw } })),
                ],
            },
            ...(stackDomains.length > 0 ? [{ affectedStacks: { hasSome: stackDomains } }] : []),
        ];
    }
    else if (stackDomains.length > 0) {
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
    }
    catch (err) {
        console.error('[GET /solutions] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * GET /solutions/earnings?stacksAddress=ST...  (or ?email=...)
 * Returns all solutions authored by a given resolver + payment counts.
 * Accepts stacksAddress (wallet auth) or email (legacy fallback).
 */
router.get('/earnings', async (req, res) => {
    const { stacksAddress, email } = req.query;
    if (!stacksAddress && !email) {
        return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'stacksAddress or email query parameter is required.' } });
    }
    try {
        const user = stacksAddress
            ? await prisma.user.findUnique({ where: { stacksAddress: stacksAddress } })
            : await prisma.user.findUnique({ where: { email: email } });
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
        const paymentCounts = await Promise.all(solutions.map(s => prisma.payment.count({ where: { solutionId: s.id, status: 'confirmed' } })));
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
    }
    catch (err) {
        console.error('[GET /solutions/earnings] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * GET /solutions/search
 * Free — no payment required. Always the first call an agent makes.
 * Query params: q, stack, error_type, limit
 */
router.get('/search', async (req, res) => {
    const { q, stack, error_type, limit = '5' } = req.query;
    if (!q) {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'q query parameter is required.' },
        });
    }
    const STOP_WORDS = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'to', 'of', 'is', 'it', 'no', 'not', 'be', 'as', 'or', 'and', 'for', 'from', 'with', 'that', 'this', 'was', 'are', 'has', 'have', 'but', 'by', 'can', 'do', 'we', 'my', 'our', 'if', 'so', 'use', 'using', 'file', 'line', 'when', 'after', 'error', 'failed', 'cannot', 'could', 'fix', 'named', 'module']);
    // Accept both plain string "foo bar" and JSON array "[\"foo\",\"bar\"]"
    const raw = q.trim();
    let rawTokens = [];
    if (raw.startsWith('[')) {
        try {
            rawTokens = JSON.parse(raw);
        }
        catch {
            rawTokens = raw.split(/[\s,]+/);
        }
    }
    else {
        rawTokens = raw.split(/[\s,.:'"()\[\]]+/);
    }
    const keywords = rawTokens
        .flatMap(t => t.split(/[\s.:'"()\[\]]+/)) // further split any compound tokens
        .map(k => k.trim())
        .filter(k => k.length >= 3 && !STOP_WORDS.has(k.toLowerCase()));
    const stackDomains = stack ? stack.split(',').map(s => s.trim()) : [];
    const maxLimit = Math.min(parseInt(limit, 10) || 5, 20);
    if (keywords.length === 0) {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'q must contain at least one meaningful keyword.' },
        });
    }
    const start = Date.now();
    // Score a solution against keywords — higher = better match
    function score(sol) {
        let points = 0;
        const titleLower = sol.title.toLowerCase();
        const sigsLower = sol.problemSignatures.map(s => s.toLowerCase());
        const stacksLower = sol.affectedStacks.map(s => s.toLowerCase());
        for (const kw of keywords) {
            const kwl = kw.toLowerCase();
            if (titleLower.includes(kwl))
                points += 3; // keyword in title
            if (sigsLower.some(s => s.includes(kwl)))
                points += 5; // keyword in signatures (strongest signal)
            if (stacksLower.some(s => s.includes(kwl)))
                points += 2; // keyword in affected stacks
        }
        // Boost by success rate (0–1 range adds up to 2 extra points)
        points += sol.successRate * 2;
        return points;
    }
    try {
        // Fetch broadly: any keyword matches title or any signature (OR across all)
        const candidates = await prisma.solution.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            ...keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' } })),
                            ...keywords.map(kw => ({ problemSignatures: { has: kw } })),
                            // Also match partial signature text via title fallback for compound error strings
                            ...keywords.map(kw => ({
                                problemSignatures: {
                                    isEmpty: false,
                                },
                            })).slice(0, 1), // include all solutions that have signatures set
                        ],
                    },
                    ...(stackDomains.length > 0
                        ? [{ affectedStacks: { hasSome: stackDomains } }]
                        : []),
                ],
            },
        });
        // Score and rank — return only solutions with at least 1 point
        const scored = candidates
            .map(sol => ({ sol, points: score(sol) }))
            .filter(({ points }) => points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, maxLimit)
            .map(({ sol }) => sol);
        const queryTimeMs = Date.now() - start;
        if (scored.length === 0) {
            return res.json({
                results: [],
                total: 0,
                query_time_ms: queryTimeMs,
                suggestion: 'No solutions found. You can post this problem as a live bounty via POST /problems.',
            });
        }
        return res.json({
            results: scored.map(s => ({
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
            total: scored.length,
            query_time_ms: queryTimeMs,
        });
    }
    catch (err) {
        console.error('[GET /solutions/search] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * GET /solutions/:id
 * Retrieve a previously purchased solution without paying again.
 * Agent must have a confirmed payment record for this solution.
 */
router.get('/:id', auth_1.requireAgentId, async (req, res) => {
    const { id } = req.params;
    const agentId = req.agentId;
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
    }
    catch (err) {
        console.error('[GET /solutions/:id] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
/**
 * POST /solutions
 * Expert submits a new solution.
 * Requires stacksAddress (wallet auth) + full solution payload.
 */
router.post('/', async (req, res) => {
    const { stacksAddress, title, problemSignatures, affectedStacks, priceUsdc, structuredFix, } = req.body;
    if (!stacksAddress || !title || !structuredFix) {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'stacksAddress, title, and structuredFix are required.' },
        });
    }
    try {
        const user = await prisma.user.findUnique({ where: { stacksAddress } });
        if (!user) {
            return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'No user found for this wallet address. Complete onboarding first.' } });
        }
        const solution = await prisma.solution.create({
            data: {
                title,
                authorId: user.id,
                problemSignatures: problemSignatures ?? [],
                affectedStacks: affectedStacks ?? [],
                priceUsdc: priceUsdc ?? '1.00',
                structuredFixJson: JSON.stringify(structuredFix),
            },
        });
        return res.status(201).json({
            solution_id: solution.id,
            title: solution.title,
            author: user.name,
            price_usdc: solution.priceUsdc,
            created_at: solution.createdAt,
        });
    }
    catch (err) {
        console.error('[POST /solutions] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
exports.default = router;
