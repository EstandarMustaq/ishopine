/**
 * SMTP verification mail — same contract as Nest MailService.
 */
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

let transporter: nodemailer.Transporter | null = null;

function ensureTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const options: SMTPTransport.Options = {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  };
  transporter = nodemailer.createTransport(options);
  return transporter;
}

export function mailConfigured() {
  return ensureTransporter() !== null;
}

export async function sendVerificationCode(
  email: string,
  code: string,
  purpose = "verificação de e-mail",
) {
  const from =
    process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@ishopine.com";
  const subject = `iShopine — código de ${purpose}`;
  const text = `O seu código é ${code}. Expira em 15 minutos.\n\niShopine`;
  const html = `
      <p>O seu código de ${purpose} é:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>
      <p>Expira em 15 minutos.</p>
      <p>— iShopine</p>
    `;

  const tx = ensureTransporter();
  if (!tx) {
    console.warn(`[identity][DEV] SMTP não configurado. Código para ${email}: ${code}`);
    return { delivered: false, logged: true };
  }

  await tx.sendMail({ from, to: email, subject, text, html });
  return { delivered: true, logged: false };
}
