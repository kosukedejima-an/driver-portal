import Link from "next/link";
import { Suspense } from "react";
import { AdminNoticeNav } from "@/components/AdminNoticeNav";
import { AdminShell } from "@/components/AdminShell";
import { CategoryBadge } from "@/components/CategoryBadge";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { RateBar } from "@/components/RateBar";
import { requireAdmin } from "@/lib/auth";
import { formatDate, rate } from "@/lib/format";
import type { Notice, Profile } from "@/lib/types";

async function ReadsList() {
  const { supabase } = await requireAdmin();
  const [noticesRes, summaryRes, driversRes] = await Promise.all([
    supabase.from("notices").select("*").order("published_at", { ascending: false }),
    supabase.from("notice_read_summary").select("notice_id, read_count"),
    supabase.from("profiles").select("*").eq("role", "driver"),
  ]);
  if (noticesRes.error) throw noticesRes.error;
  if (summaryRes.error) throw summaryRes.error;

  const notices = (noticesRes.data as Notice[]).filter((n) => !n.hidden_at);
  const readCounts = new Map(summaryRes.data.map((s) => [s.notice_id as string, Number(s.read_count)]));
  // 利用停止中のドライバーは数えない
  const total = ((driversRes.data ?? []) as Profile[]).filter((d) => d.is_active !== false).length;

  if (notices.length === 0) {
    return <p className="py-8 text-center text-base text-gray-600">お知らせはまだありません</p>;
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {notices.map((n) => {
        const read = readCounts.get(n.id) ?? 0;
        return (
          <li key={n.id}>
            <Link href={`/admin/reads/${n.id}`} className="block h-full rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={n.category} />
                <span className="text-sm text-gray-600">{formatDate(n.published_at)}</span>
                {n.is_dummy && <DummyBadge />}
              </div>
              <h2 className="mt-2 text-base font-bold leading-snug">{n.title}</h2>
              <div className="mt-3 flex items-center gap-3">
                <RateBar read={read} total={total} />
                <span className="shrink-0 text-sm font-bold">
                  {read}/{total}人（{rate(read, total)}%）
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminReadsPage() {
  return (
    <AdminShell current="/admin/reads">
      <AdminNoticeNav current="/admin/reads" />
      <p className="text-sm text-gray-600">確認状況を見たいお知らせを選んでください。</p>
      <Suspense fallback={<Loading />}>
        <ReadsList />
      </Suspense>
    </AdminShell>
  );
}
