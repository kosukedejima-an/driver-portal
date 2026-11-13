"use client";

import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";

/**
 * 画面の上の帯に出す会社ロゴ。高さ26px。
 * ロゴ画像（src/config/site.ts の logoSrc）がない・見つからないときは、会社名を白い文字で表示する。
 */
export function Logo() {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 画面の準備が整う前に読み込みに失敗していた場合も、代わりの表示に切り替える
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!siteConfig.logoSrc || failed) {
    return <span className="text-base font-bold tracking-wider text-white">{siteConfig.companyName}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 縦横比を保ったまま高さだけ指定するため通常の img を使う
    <img
      ref={imgRef}
      src={siteConfig.logoSrc}
      alt={siteConfig.companyName}
      className="h-[26px] w-auto"
      onError={() => setFailed(true)}
    />
  );
}
