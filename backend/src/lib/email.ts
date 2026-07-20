// Email sender. Uses Resend in production. In dev (or if RESEND_API_KEY isn't
// configured yet), logs the email to the console so we can test the OTP flow
// without burning real email quota.
import { Resend } from 'resend';
import { env } from './env';

const hasRealKey = env.resendApiKey && env.resendApiKey.startsWith('re_') && !env.resendApiKey.includes('xxx');
const resend = hasRealKey ? new Resend(env.resendApiKey) : null;

export type EmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(params: EmailParams): Promise<void> {
  if (!resend) {
    // Dev fallback. Print to the server log so you can grab the code from
    // Window A without having to plug in Resend during local testing.
    console.log('\n=== EMAIL (dev mode, not sent) ===');
    console.log(`To:      ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`---\n${params.text}\n===\n`);
    return;
  }

  await resend.emails.send({
    from: env.resendFrom,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

export function renderOtpEmail(code: string) {
  const subject = 'Your Expense Diary password reset code';
  const text = `Your password reset code is: ${code}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0d1117;">
      <h2 style="margin:0 0 16px;color:#0d1117;">Reset your password</h2>
      <p style="font-size:15px;line-height:1.5;color:#444;">
        Enter this code in the Expense Diary app to continue:
      </p>
      <div style="background:#f4f7fb;border:1px solid #d0d7de;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0969da;font-family:monospace;">
          ${code}
        </div>
      </div>
      <p style="font-size:13px;color:#666;line-height:1.5;">
        This code expires in 15 minutes. If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;
  return { subject, text, html };
}
