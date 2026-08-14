import { Injectable } from '@nestjs/common';

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

/** MailServiceの実送信を行わないテスト用差し替え。本文からOTP/トークンを取り出すために使う。 */
@Injectable()
export class MockMailService {
  public readonly sent: SentMail[] = [];

  async send(to: string, subject: string, text: string): Promise<void> {
    this.sent.push({ to, subject, text });
  }

  latestFor(to: string): SentMail | undefined {
    return [...this.sent].reverse().find((m) => m.to === to);
  }
}
