import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const router = Router();
const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0C0C0C;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0C0C0C;">
  <tr>
    <td align="center" bgcolor="#0C0C0C" style="padding:48px 24px;background-color:#0C0C0C;">
      <table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background-color:#0C0C0C;">

        <!-- Logo -->
        <tr>
          <td style="padding-bottom:40px;background-color:#0C0C0C;">
            <span style="font-family:'Courier New',monospace;font-size:15px;font-weight:500;color:#E8E5DF;letter-spacing:-0.01em;">quash</span>
          </td>
        </tr>

        <!-- Heading -->
        <tr>
          <td style="padding-bottom:20px;background-color:#0C0C0C;">
            <h1 style="margin:0;font-family:'Courier New',monospace;font-size:22px;font-weight:500;line-height:1.2;letter-spacing:-0.02em;color:#E8E5DF;">You're on the waitlist.</h1>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding-bottom:14px;background-color:#0C0C0C;">
            <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;line-height:1.8;color:#A09B92;">We review every application personally. If your background looks like a good fit, we will reach out to schedule a short interview.</p>
          </td>
        </tr>

        <!-- Rule -->
        <tr>
          <td style="padding:32px 0;background-color:#0C0C0C;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="1" bgcolor="#1F1F1F" style="background-color:#1F1F1F;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Next label -->
        <tr>
          <td style="padding-bottom:16px;background-color:#0C0C0C;">
            <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;color:#5A554E;letter-spacing:0.14em;text-transform:uppercase;">what happens next</p>
          </td>
        </tr>

        <!-- Step 01 -->
        <tr>
          <td style="padding-bottom:14px;background-color:#0C0C0C;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="36" valign="top" style="font-family:'Courier New',monospace;font-size:10px;color:#2E2B27;letter-spacing:0.06em;padding-top:1px;background-color:#0C0C0C;">01 —</td>
                <td style="background-color:#0C0C0C;">
                  <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:12px;font-weight:500;color:#E8E5DF;">We review your application</p>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;color:#A09B92;line-height:1.6;">Within 5 business days.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Step 02 -->
        <tr>
          <td style="padding-bottom:14px;background-color:#0C0C0C;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="36" valign="top" style="font-family:'Courier New',monospace;font-size:10px;color:#2E2B27;letter-spacing:0.06em;padding-top:1px;background-color:#0C0C0C;">02 —</td>
                <td style="background-color:#0C0C0C;">
                  <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:12px;font-weight:500;color:#E8E5DF;">Short interview</p>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;color:#A09B92;line-height:1.6;">We will reach out to schedule a call to understand your expertise and how you work.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Step 03 -->
        <tr>
          <td style="padding-bottom:0;background-color:#0C0C0C;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="36" valign="top" style="font-family:'Courier New',monospace;font-size:10px;color:#2E2B27;letter-spacing:0.06em;padding-top:1px;background-color:#0C0C0C;">03 —</td>
                <td style="background-color:#0C0C0C;">
                  <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:12px;font-weight:500;color:#E8E5DF;">Onboarding</p>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;color:#A09B92;line-height:1.6;">If it is a good fit, we get you set up and earning.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Rule -->
        <tr>
          <td style="padding:32px 0;background-color:#0C0C0C;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="1" bgcolor="#1F1F1F" style="background-color:#1F1F1F;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#0C0C0C;">
            <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;color:#2E2B27;line-height:1.7;">
              You signed up at <a href="https://quash-mvp.vercel.app" style="color:#5A554E;text-decoration:none;">quash-mvp.vercel.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

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
    transporter.sendMail({
      from: `Quash <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "You're on the Quash waitlist",
      html: CONFIRMATION_HTML,
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
