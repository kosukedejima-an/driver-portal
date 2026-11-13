import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { NoticeSummary } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { DummyBadge } from "./DummyBadge";

export function NoticeCard({ notice }: { notice: NoticeSummary }) {
  const unread = !notice.isRead;
  return (
    <Link
      href={`/notices/${notice.id}`}
      className={`block rounded-lg bg-white p-4 ${
        unread ? "border-2 border-unread" : "border border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={notice.category} />
        {unread ? (
          <span className="text-sm font-bold text-unread">● 未確認</span>
        ) : (
          <span className="text-sm text-gray-500">確認済み</span>
        )}
        {notice.is_dummy && <DummyBadge />}
      </div>
      <h3 className="mt-2 text-base font-bold leading-snug">{notice.title}</h3>
      <p className="mt-1 text-sm text-gray-600">{formatDate(notice.published_at)}</p>
    </Link>
  );
}
