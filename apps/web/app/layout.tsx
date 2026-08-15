import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '../src/lib/query-provider';
import { AuthProvider } from '../src/lib/auth-context';
import { AppShell } from '../src/components/nav/app-shell';

export const metadata: Metadata = {
  title: '羅針盤キャリアOS',
  description: 'SES企業向け、AI支援によるキャリア形成・目標管理・1on1支援アプリ',
};

/**
 * ルートレイアウト。Phase4 1.1節のロール別ナビゲーション分岐は、AppShellが
 * セッション有無に応じてヘッダー/サイドナビの出し分けを行う形で実装する
 * （AUTH画面ではセッションがまだ無いため、AppShellはchildrenをそのまま素通しする）。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-900">
        <QueryProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
