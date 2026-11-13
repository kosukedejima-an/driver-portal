import { siteConfig } from "@/config/site";
import type { MetadataRoute } from "next";

// ホーム画面に追加したときのアプリの名前・アイコン・色
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.appName,
    short_name: siteConfig.appShortName,
    description: "ドライバー向け社内アプリ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#701648",
    lang: "ja",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
