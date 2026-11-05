import dns from 'dns';
import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/ApiError';

// Prefer IPv4 — some hosts (incl. Render) have flaky IPv6 to smtp.gmail.com.
dns.setDefaultResultOrder('ipv4first');

export function isSmtpConfigured(): boolean {
  return Boolean(env.smtpUser && env.smtpPass);
}

function resetBaseUrl(): string {
  if (env.passwordResetUrlBase) {
    return env.passwordResetUrlBase.replace(/\/+$/, '');
  }
  const httpsOrigin = env.frontendOrigins.find((origin) => origin.startsWith('https://'));
  return (httpsOrigin ?? env.frontendOrigins[0] ?? 'http://localhost:8081').replace(/\/+$/, '');
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    requireTLS: env.smtpPort === 587,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });
}

function buildPasswordResetHtml(resetUrl: string) {
  // Inline styles only — email clients strip external CSS. Matches Achievo lime/charcoal theme.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reset your Achievo password</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F5F2;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E5DC;">
          <tr>
            <td style="background-color:#050505;padding:28px 28px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#9BCF2E,#C8F54A);background-color:#C8F54A;text-align:center;vertical-align:middle;font-size:20px;font-weight:700;color:#0A0A0A;line-height:40px;">
                    A
                  </td>
                  <td style="padding-left:12px;font-size:18px;font-weight:700;color:#F5F5F5;letter-spacing:-0.02em;">
                    Achievo AI
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;color:#9A9A9A;">Your Goals. Your Plan. Your Progress.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#101010;font-weight:700;">Reset your password</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#6B6F66;">
                We received a request to reset the password for your Achievo account. Tap the button below to choose a new one.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <tr>
                  <td style="border-radius:12px;background-color:#9BCF2E;">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;color:#101010;text-decoration:none;">
                      Choose a new password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6B6F66;">
                This link expires in <strong style="color:#101010;">30 minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6B6F66;">
                If you did not ask for a reset, you can ignore this email — your password will stay the same.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;">
              <p style="margin:0;padding-top:16px;border-top:1px solid #E2E5DC;font-size:12px;line-height:1.5;color:#8A8F84;">
                Button not working? Paste this link into your browser:<br />
                <a href="${resetUrl}" style="color:#7FB01A;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(input: { to: string; resetToken: string }) {
  if (!isSmtpConfigured()) {
    throw new ApiError(503, 'Email delivery is not configured');
  }

  const resetUrl = `${resetBaseUrl()}/forgot-password?token=${encodeURIComponent(input.resetToken)}`;
  const from = env.smtpFrom || env.smtpUser;
  const transport = createTransport();

  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: 'Reset your Achievo password',
      text: [
        'Reset your Achievo password',
        '',
        'We received a request to reset the password for your Achievo account.',
        'Open this link to choose a new password (expires in 30 minutes):',
        resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: buildPasswordResetHtml(resetUrl),
    });
    logger.info(
      {
        to: input.to,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
        resetBase: resetBaseUrl(),
      },
      'Password reset email sent',
    );
  } catch (error) {
    logger.error({ err: error, to: input.to, host: env.smtpHost, port: env.smtpPort }, 'Failed to send password reset email');
    throw new ApiError(503, 'Unable to send password reset email right now');
  }
}
