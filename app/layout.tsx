import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your Reader",
  description: "당신의 마음을 조용히 읽어주는 가상의 독자",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
