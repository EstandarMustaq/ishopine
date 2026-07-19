import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      const options: SMTPTransport.Options = {
        host,
        port: Number(this.config.get('SMTP_PORT', 587)),
        secure: this.config.get('SMTP_SECURE', 'false') === 'true',
        auth: { user, pass },
      };
      this.transporter = nodemailer.createTransport(options);
    }
  }

  isConfigured() {
    return this.transporter !== null;
  }

  async sendVerificationCode(
    email: string,
    code: string,
    purpose = 'verificação de e-mail',
  ) {
    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('SMTP_USER') ||
      'noreply@nkateko.com';
    const subject = `Nkateko — código de ${purpose}`;
    const text = `Seu código é ${code}. Ele expira em 15 minutos.\n\nNkateko Investment and Service`;
    const html = `
      <p>Seu código de ${purpose} é:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>
      <p>Ele expira em 15 minutos.</p>
      <p>— Nkateko Investment and Service</p>
    `;

    if (!this.transporter) {
      this.logger.warn(
        `[DEV] SMTP não configurado. Código para ${email}: ${code}`,
      );
      return { delivered: false, logged: true };
    }

    await this.transporter.sendMail({ from, to: email, subject, text, html });
    return { delivered: true, logged: false };
  }
}
