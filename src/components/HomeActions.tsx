import Link from "next/link";
import { Suspense } from "react";
import { getNoticeSummaries } from "@/lib/queries";

const iconProps = {
  className: "size-7",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** ベルに付ける未読の合計数（赤の丸） */
async function UnreadCount() {
  const unread = (await getNoticeSummaries()).filter((n) => !n.isRead).length;
  if (unread === 0) return null;
  return (
    <>
      <span className="absolute -top-0.5 -right-0.5 flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-unread px-1 text-sm leading-5 font-bold text-white">
        {unread > 99 ? "99+" : unread}
      </span>
      <span className="sr-only">（未読{unread}件）</span>
    </>
  );
}

/** ホームの見出し右上：通知ベル（お知らせ一覧へ）と人型（マイページへ） */
export function HomeActions() {
  return (
    <>
      <Link href="/notices" className="relative flex size-11 items-center justify-center rounded-full">
        <svg {...iconProps}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span className="sr-only">お知らせ一覧</span>
        <Suspense fallback={null}>
          <UnreadCount />
        </Suspense>
      </Link>
      <Link href="/mypage" className="flex size-11 items-center justify-center rounded-full">
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        <span className="sr-only">マイページ</span>
      </Link>
    </>
  );
}
