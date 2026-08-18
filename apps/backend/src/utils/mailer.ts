import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 465,
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    logger.error('SMTP transporter verification failed:', error);
  } else {
    logger.info('SMTP transporter ready');
  }
});

interface SendUserInviteEmailParams {
  to: string;
  firstName: string;
  resetToken: string;
}

export const sendUserInviteEmail = async ({
  to,
  firstName,
  resetToken,
}: SendUserInviteEmailParams): Promise<void> => {
  const setPasswordUrl = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Welcome to Planning Earth</h2>
      <p>Hi ${firstName},</p>
      <p>An admin has created an account for you on Planning Earth. Click the button below to set your password and get started.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${setPasswordUrl}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          Set Your Password
        </a>
      </p>
      <p>This link will expire in 24 hours. If you didn't expect this email, you can safely ignore it.</p>
      <p style="color:#888;font-size:12px;word-break:break-all;">${setPasswordUrl}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
      <p style="color:#999;font-size:11px;">This is an automated message — please do not reply to this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Planning Earth (No-Reply)" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Your Planning Earth account has been created',
    html,
  });
};
export default transporter;