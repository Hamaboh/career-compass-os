import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Compass OS",
  description: "ULによるMember支援管理",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main-content">
          本文へ移動
        </a>
        <header>
          <strong>Career Compass OS</strong>
          <nav aria-label="主要ナビゲーション">
            <Link href="/members">Member</Link>
            <Link href="/executive">全Unitレビュー</Link>
            <Link href="/admin">管理・運用</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
