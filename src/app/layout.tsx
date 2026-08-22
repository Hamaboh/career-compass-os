import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Compass OS",
  description: "Repository foundation",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <header>
          <strong>Career Compass OS</strong>
        </header>
        {children}
      </body>
    </html>
  );
}
