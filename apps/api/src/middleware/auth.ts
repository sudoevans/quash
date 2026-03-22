import { Request, Response, NextFunction } from 'express';

/** Ensures X-Agent-Id header is present for agent endpoints */
export function requireAgentId(req: Request, res: Response, next: NextFunction) {
  const agentId = req.headers['x-agent-id'];
  if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
    return res.status(401).json({
      error: { code: 'MISSING_AGENT_ID', message: 'X-Agent-Id header is required.' },
    });
  }
  // Attach to request for downstream use
  (req as any).agentId = agentId.trim();
  next();
}

/** Verifies Hiro Chainhook consumer secret via Authorization: Bearer <secret> header */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CHAINHOOK_CONSUMER_SECRET;
  if (!secret) return next(); // skip if not configured (dev without Chainhook)

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: { code: 'MISSING_SIGNATURE', message: 'Authorization header required.' } });
  }

  if (authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid consumer secret.' } });
  }

  next();
}
