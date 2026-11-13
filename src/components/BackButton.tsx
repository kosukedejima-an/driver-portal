"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// アプリを開いてから、アプリの中で何画面目か（開き直す・読み込み直すと 0 から数え直す）
let visits = 0;
// 「戻る」で前の画面に戻ったところ（覚えておいた古い表示のままなので、読み直す）
let cameBack = false;

/**
 * アプリの中で画面を移ったことを数える（ルートの layout に1つだけ置く）。
 * 「‹ 戻る」やスマホの戻る操作で戻ったときは、その画面を最新の状態に読み直す
 * （資料の「新着」の印や、お知らせの「未確認」が古いまま残らないように）。
 */
export function NavTracker() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const onPop = () => {
      cameBack = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    visits++;
    if (cameBack) {
      cameBack = false;
      router.refresh();
    }
  }, [pathname, router]);
  return null;
}

/**
 * 「‹ 戻る」：一つ前に見ていた画面に戻る（ジャンル・検索・スクロールの位置もそのまま）。
 * 通知から直接開いたときなど、アプリの中に前の画面がなければ fallback へ行く。
 */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      onClick={(e) => {
        if (visits > 1) {
          e.preventDefault();
          cameBack = true;
          router.back();
        }
      }}
      className="-ml-2 flex min-h-11 items-center rounded px-2 text-base"
    >
      ‹ 戻る
    </Link>
  );
}
