"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
/**
 * POST /auth/connect
 * Called after wallet connection on the onboarding page.
 * Upserts a User record keyed by stacksAddress.
 */
router.post('/connect', async (req, res) => {
    const { stacksAddress, name, githubHandle, email } = req.body;
    if (!stacksAddress || typeof stacksAddress !== 'string') {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'stacksAddress is required.' },
        });
    }
    if (!name || typeof name !== 'string') {
        return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'name is required.' },
        });
    }
    try {
        const user = await prisma.user.upsert({
            where: { stacksAddress },
            create: {
                stacksAddress,
                name: name.trim(),
                githubId: githubHandle ? githubHandle.replace(/^@/, '').trim() : null,
                email: email?.trim() || null,
            },
            update: {
                name: name.trim(),
                githubId: githubHandle ? githubHandle.replace(/^@/, '').trim() : undefined,
                email: email?.trim() || undefined,
            },
        });
        return res.json({
            user_id: user.id,
            stacksAddress: user.stacksAddress,
            name: user.name,
            githubHandle: user.githubId,
        });
    }
    catch (err) {
        console.error('[POST /auth/connect] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to register user.' } });
    }
});
/**
 * GET /auth/me?address=ST...
 * Returns the user record for a given Stacks address.
 */
router.get('/me', async (req, res) => {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'address query param required.' } });
    }
    try {
        const user = await prisma.user.findUnique({ where: { stacksAddress: address } });
        if (!user) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
        }
        return res.json({ user_id: user.id, stacksAddress: user.stacksAddress, name: user.name, githubHandle: user.githubId });
    }
    catch (err) {
        console.error('[GET /auth/me] Error:', err);
        return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
    }
});
exports.default = router;
