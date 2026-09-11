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
        <header>
          <strong>Career Compass OS</strong>{" "}
          <Link href="/members" style={{ color: "white", marginLeft: "2rem" }}>
            Member
          </Link>{" "}
          <Link
            href="/executive"
            style={{ color: "white", marginLeft: "2rem" }}
          >
            全Unitレビュー
          </Link>{" "}
          <Link href="/admin" style={{ color: "white", marginLeft: "2rem" }}>
            管理・運用
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
