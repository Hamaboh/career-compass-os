import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '羅針盤キャリアOS',
  description: 'SES企業向け、AI支援によるキャリア形成・目標管理・1on1支援アプリ',
};

/**
 * ルートレイアウト。Phase4 1.1節のロール別ナビゲーション（Member/UL/ADMIN）分岐は
 * Step 0（認証基盤）でセッション判定ロジックと合わせて実装する。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
