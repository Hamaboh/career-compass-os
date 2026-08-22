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
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
