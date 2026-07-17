import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "당신의 독자",
  description: "생각과 마음을 안전하게 기록하는 몰입형 글쓰기 공간",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
