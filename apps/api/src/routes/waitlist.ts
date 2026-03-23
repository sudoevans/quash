import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

const router = Router();
const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Quash <onboarding@resend.dev>';

/**
 * POST /waitlist
 * Store email and send confirmation. Idempotent — safe to call twice.
 */
router.post('/', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' },
    });
  }

  try {
    const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
    if (existing) {
      return res.json({ status: 'already_registered' });
    }

    await prisma.waitlistEntry.create({ data: { email } });

    // Confirmation email — fire-and-forget, never blocks the response
    resend.emails.send({
      from: FROM,
      to: email,
      subject: "You're on the Quash waitlist",
      html: `
        <div style="font-family:monospace;background:#0C0C0C;color:#E8E4DC;padding:40px;max-width:480px;margin:0 auto">
          <p style="font-size:18px;font-weight:bold;margin:0 0 16px">Request received.</p>
          <p style="font-size:13px;line-height:1.6;color:#A89F8C;margin:0 0 24px">
            You're on the Quash waitlist. We'll reach out when access opens.
          </p>
          <p style="font-size:13px;color:#A89F8C;margin:0">— Quash</p>
          <hr style="border:none;border-top:1px solid #2A2A2A;margin:32px 0" />
          <p style="font-size:11px;color:#5A5A5A;margin:0">
            quash.fly.dev &nbsp;·&nbsp; Errors solved by humans. Paid by agents.
          </p>
        </div>
      `,
    }).catch((err: Error) => {
      console.warn('[waitlist] confirmation email failed:', err.message);
    });

    return res.status(201).json({ status: 'registered' });
  } catch (err) {
    console.error('[POST /waitlist]', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to join waitlist.' },
    });
  }
});

export default router;
