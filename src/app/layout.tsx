import { siteConfig } from "@/config/site";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { NavTracker } from "@/components/BackButton";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: siteConfig.appName,
  description: "ドライバー向け社内アプリ",
  // 社内専用のため、検索エンジンに載せない
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // iPhone でホーム画面に追加したときの設定
  appleWebApp: { capable: true, title: siteConfig.appShortName, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#701648",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
        <Suspense fallback={null}>
          <NavTracker />
        </Suspense>
      </body>
    </html>
  );
}
