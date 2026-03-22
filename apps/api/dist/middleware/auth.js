"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAgentId = requireAgentId;
exports.verifyWebhookSignature = verifyWebhookSignature;
/** Ensures X-Agent-Id header is present for agent endpoints */
function requireAgentId(req, res, next) {
    const agentId = req.headers['x-agent-id'];
    if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
        return res.status(401).json({
            error: { code: 'MISSING_AGENT_ID', message: 'X-Agent-Id header is required.' },
        });
    }
    // Attach to request for downstream use
    req.agentId = agentId.trim();
    next();
}
/** Verifies Hiro Chainhook consumer secret via Authorization: Bearer <secret> header */
function verifyWebhookSignature(req, res, next) {
    const secret = process.env.CHAINHOOK_CONSUMER_SECRET;
    if (!secret)
        return next(); // skip if not configured (dev without Chainhook)
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: { code: 'MISSING_SIGNATURE', message: 'Authorization header required.' } });
    }
    if (authHeader !== `Bearer ${secret}`) {
        return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid consumer secret.' } });
    }
    next();
}
