import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

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

/** Verifies HMAC-SHA256 signature for Chainhook webhooks */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CHAINHOOK_WEBHOOK_SECRET;
  if (!secret) return next(); // skip in dev if not configured

  const signature = req.headers['x-agentflow-signature'] as string;
  if (!signature) {
    return res.status(401).json({ error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature required.' } });
  }

  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const safe = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!safe) {
    return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Signature mismatch.' } });
  }
  next();
}
