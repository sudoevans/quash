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
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're on the Quash waitlist</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #0C0C0C; font-family: 'DM Mono', 'Courier New', monospace; color: #E8E5DF; -webkit-font-smoothing: antialiased; padding: 48px 24px; }
    .container { max-width: 480px; margin: 0 auto; }
    .logo { font-size: 15px; font-weight: 500; color: #E8E5DF; letter-spacing: -0.01em; margin-bottom: 40px; display: block; }
    .rule { border: none; border-top: 1px solid #1F1F1F; margin: 32px 0; }
    h1 { font-size: 22px; font-weight: 500; line-height: 1.2; letter-spacing: -0.02em; color: #E8E5DF; margin-bottom: 20px; }
    p { font-size: 13px; line-height: 1.8; color: #A09B92; margin-bottom: 14px; }
    .next-label { font-size: 10px; color: #5A554E; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 16px; }
    .step { display: flex; gap: 14px; margin-bottom: 14px; }
    .step-num { font-size: 10px; color: #2E2B27; flex-shrink: 0; padding-top: 1px; letter-spacing: 0.06em; }
    .step-text { font-size: 12px; color: #A09B92; line-height: 1.6; }
    .step-text strong { color: #E8E5DF; font-weight: 500; display: block; margin-bottom: 2px; }
    .footer-text { font-size: 11px; color: #2E2B27; line-height: 1.7; }
    a { color: #5A554E; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <span class="logo">quash</span>
    <h1>You're on the waitlist.</h1>
    <p>We review every application personally. If your background looks like a good fit, we will reach out to schedule a short interview.</p>
    <hr class="rule">
    <p class="next-label">what happens next</p>
    <div class="step">
      <span class="step-num">01 —</span>
      <div class="step-text"><strong>We review your application</strong>Within 5 business days.</div>
    </div>
    <div class="step">
      <span class="step-num">02 —</span>
      <div class="step-text"><strong>Short interview</strong>We will reach out to schedule a call to understand your expertise and how you work.</div>
    </div>
    <div class="step">
      <span class="step-num">03 —</span>
      <div class="step-text"><strong>Onboarding</strong>If it is a good fit, we get you set up and earning.</div>
    </div>
    <hr class="rule">
    <p class="footer-text">
      You signed up at <a href="https://quash-mvp.vercel.app">quash-mvp.vercel.app</a>
    </p>
  </div>
</body>
</html>`,
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
