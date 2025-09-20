import 'dotenv/config';
import nodemailer from 'nodemailer';

// Support multiple env var names for convenience
const gmailUser = (process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
const gmailPass = (process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

// Create a reusable transporter using Gmail
export const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
});

export async function sendEmail({ to, subject, text, html }) {
  if (!gmailUser || !gmailPass) {
    return { ok: false, error: 'Email not configured. Set EMAIL_USER and EMAIL_PASS in .env' };
  }

  const mailOptions = {
    from: gmailUser,
    to,
    subject,
    text: text || '',
    html: html || undefined,
  };

  try {
    // Verify SMTP configuration before sending
    await emailTransporter.verify();
    const result = await emailTransporter.sendMail(mailOptions);
    return { ok: true, messageId: result.messageId };
  } catch (error) {
    // Include rich error details if available
    const errMsg = error?.response?.toString?.() || error?.message || 'Unknown email error';
    return { ok: false, error: errMsg };
  }
}


