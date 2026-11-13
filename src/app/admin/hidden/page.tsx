import Link from "next/link";
import { Suspense } from "react";
import { AdminNoticeNav } from "@/components/AdminNoticeNav";
import { AdminShell } from "@/components/AdminShell";
import { CategoryBadge } from "@/components/CategoryBadge";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Notice } from "@/lib/types";

async function HiddenList() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .not("hidden_at", "is", null)
    .order("hidden_at", { ascending: false });
  if (error) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。
      </p>
    );
  }
  const notices = data as Notice[];
  if (notices.length === 0) {
    return <p className="py-8 text-center text-base text-gray-600">非表示のお知らせはありません</p>;
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {notices.map((n) => (
        <li key={n.id}>
          <Link href={`/admin/reads/${n.id}`} className="block h-full rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={n.category} />
              <span className="text-sm text-gray-600">{formatDate(n.published_at)}</span>
              {n.is_dummy && <DummyBadge />}
            </div>
            <h2 className="mt-2 text-base font-bold leading-snug">{n.title}</h2>
            <p className="mt-1 text-sm text-gray-600">非表示にした日時：{formatDateTime(n.hidden_at!)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function DeletedMessage({ searchParams }: Pick<PageProps<"/admin/hidden">, "searchParams">) {
  const { done } = await searchParams;
  if (done !== "deleted") return null;
  return (
    <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">
      お知らせを完全に削除しました。削除の記録は「操作履歴」に残っています。
    </p>
  );
}

export default function AdminHiddenPage({ searchParams }: PageProps<"/admin/hidden">) {
  return (
    <AdminShell current="/admin/reads">
      <AdminNoticeNav current="/admin/hidden" />
      <Suspense fallback={null}>
        <DeletedMessage searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-gray-600">
        非表示のお知らせはドライバーには見えません。選ぶと、再表示や完全な削除ができます。
      </p>
      <Suspense fallback={<Loading />}>
        <HiddenList />
      </Suspense>
    </AdminShell>
  );
}
