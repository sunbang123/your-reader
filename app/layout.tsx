import type { Metadata, Viewport } from "next";
import { PwaInstaller } from "./pwa-installer";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Your Reader",
  title: "당신의 입장 | Your Reader",
  description: "생각과 마음을 안전하게 기록하고 공감 어린 답장을 받는 몰입형 글쓰기 공간",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Your Reader",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#30473a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <PwaInstaller />
      </body>
    </html>
  );
}
