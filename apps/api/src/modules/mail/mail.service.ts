import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Phase3 2章「メール送信: 会社SMTP優先、無料枠API代替」に対応。
 * SMTP_HOST が未設定（ローカル開発時など）の場合は、実際には送信せず内容をログへ出力する
 * streamTransport にフォールバックする。件名・宛先は出力するが、本文中のOTP/URLトークンの
 * "値そのもの" をログに残すかはこのサービスの責務ではなく、呼び出し側（Invitations/Auth）が
 * 何を本文に埋めるかで決まる点に注意（OTP自体はログ出力しない方針は各Serviceで担保する）。
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly isDevFallback: boolean;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from = this.config.get<string>('SMTP_FROM') ?? '羅針盤キャリアOS <noreply@example.com>';

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? {
              user: this.config.get<string>('SMTP_USER'),
              pass: this.config.get<string>('SMTP_PASSWORD'),
            }
          : undefined,
      });
      this.isDevFallback = false;
    } else {
      // SMTP未設定時のフォールバック。実送信はせず、件名・宛先のみログへ記録する。
      this.transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
      this.isDevFallback = true;
      this.logger.warn('SMTP_HOST未設定のため、メールは実送信されません（開発用フォールバック）');
    }
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, text });
    if (this.isDevFallback) {
      this.logger.log(`[dev-mail] to=${to} subject="${subject}"（本文は送信していません）`);
    }
  }
}
