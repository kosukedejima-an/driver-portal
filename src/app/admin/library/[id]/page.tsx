import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { RateBar } from "@/components/RateBar";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/fetch-all";
import { formatDate, formatDateTime, rate } from "@/lib/format";
import type { LibraryItem } from "@/lib/library";
import type { Office, Profile } from "@/lib/types";
import { LibraryControls } from "./LibraryControls";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Detail({ params }: { params: PageProps<"/admin/library/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data: item } = await supabase.from("library_items").select("*").eq("id", id).maybeSingle<LibraryItem>();
  if (!item) notFound();
  const [genreRes, officesRes, drivers, views] = await Promise.all([
    supabase.from("library_genres").select("name").eq("id", item.genre_id).maybeSingle<{ name: string }>(),
    supabase.from("offices").select("id, name").order("sort_order"),
    fetchAll<Profile>((f, t) => supabase.from("profiles").select("*").eq("role", "driver").eq("is_active", true).order("employee_no").range(f, t)),
    // "*"：確認の列（supabase/setup.sql）がまだ無くても動くように
    fetchAll<{ user_id: string; viewed_at: string; confirmed_at?: string | null }>((f, t) =>
      supabase.from("library_views").select("*").eq("item_id", id).range(f, t),
    ),
  ]);
  const offices = (officesRes.data ?? []) as Office[];
  // 確認ボタンのある資料は「最新の内容で確認を押した人」、ない資料は「最新の内容を開いた人」を数える
  const confirmMode = Boolean(item.requires_confirm);
  const doneAt = (v: (typeof views)[number]) => (confirmMode ? v.confirmed_at ?? null : v.viewed_at);
  const latest = new Set(views.filter((v) => (doneAt(v) ?? "") >= item.content_updated_at).map((v) => v.user_id));
  const older = new Set(views.filter((v) => doneAt(v) && doneAt(v)! < item.content_updated_at).map((v) => v.user_id));
  // 確認ボタンのある資料で、開いたけれどまだ押していない人
  const openedOnly = new Set(views.filter((v) => confirmMode && !latest.has(v.user_id) && v.viewed_at >= item.content_updated_at).map((v) => v.user_id));
  const word = confirmMode ? "確認" : "閲覧";
  const total = drivers.length;
  const seen = drivers.filter((d) => latest.has(d.id)).length;
  const groups = [
    ...offices.map((o) => ({ key: o.id, name: o.name, members: drivers.filter((d) => d.office_id === o.id) })),
    { key: "none", name: "営業所未設定", members: drivers.filter((d) => !offices.some((o) => o.id === d.office_id)) },
  ].filter((g) => g.members.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <section className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">{genreRes.data?.name}</span>
          {item.hidden_at && <span className="rounded bg-gray-600 px-2 py-0.5 text-sm font-bold text-white">非表示中</span>}
          {confirmMode && <span className="rounded border border-primary px-2 py-0.5 text-sm font-bold text-primary">確認ボタンあり</span>}
          {item.is_dummy && <DummyBadge />}
        </div>
        <h2 className="mt-2 text-lg font-bold leading-snug">{item.title}</h2>
        <p className="mt-1 text-sm text-gray-600">
          登録：{formatDate(item.created_at)}　／　最後に「更新」として知らせた日時：{formatDateTime(item.content_updated_at)}
        </p>
        <Link href={`/library/${item.id}`} className="mt-2 flex min-h-11 items-center text-base text-primary underline">
          ドライバーの画面で見る
        </Link>
        <div className="mt-3">
          <LibraryControls id={item.id} hidden={Boolean(item.hidden_at)} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">{word}状況（最新の内容・利用中のドライバー）</h3>
        {confirmMode && <p className="mt-1 text-sm text-gray-600">確認ボタンのある資料です。「内容を確認しました」を押した人を数えています。</p>}
        <p className="mt-2 text-base">
          <span className="text-3xl font-bold">{seen}</span> / {total}人 {word}済み
          <span className="ml-2 text-xl font-bold">（{rate(seen, total)}%）</span>
        </p>
        <div className="mt-3">
          <RateBar read={seen} total={total} size="lg" />
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {groups.map((g) => {
            const n = g.members.filter((d) => latest.has(d.id)).length;
            return (
              <li key={g.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold">{g.name}</span>
                  <span className="text-sm">
                    {n}/{g.members.length}人（{rate(n, g.members.length)}%）
                  </span>
                </div>
                <div className="mt-1">
                  <RateBar read={n} total={g.members.length} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">
          {confirmMode ? "まだ確認していない人" : "最新の内容をまだ見ていない人"} <span className="text-gold">（{total - seen}人）</span>
        </h3>
        {seen === total ? (
          <p className="mt-3 text-base">{total === 0 ? "ドライバーがまだ登録されていません。" : confirmMode ? "全員が確認しています。" : "全員が最新の内容を見ています。"}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {groups.map((g) => {
              const not = g.members.filter((d) => !latest.has(d.id));
              if (not.length === 0) return null;
              return (
                <div key={g.key}>
                  <p className="text-sm font-bold text-gray-600">{g.name}</p>
                  <ul className="mt-1 divide-y divide-gray-100">
                    {not.map((d) => (
                      <li key={d.id} className="flex min-h-11 items-center justify-between gap-2 text-base">
                        <span>
                          {d.full_name}
                          {openedOnly.has(d.id) && <span className="ml-2 text-sm text-gray-600">（開いたが、確認はまだ）</span>}
                          {!openedOnly.has(d.id) && older.has(d.id) && (
                            <span className="ml-2 text-sm text-gray-600">（更新前の内容は{confirmMode ? "確認した" : "見た"}）</span>
                          )}
                        </span>
                        <span className="text-sm text-gray-600">{d.employee_no}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const DONE: Record<string, string> = {
  created: "資料を登録しました。社員のスマホに通知を送っています。",
  updated: "更新しました。社員のスマホに「内容が更新されました」と通知を送っています。",
  saved: "保存しました（通知はしていません）。",
};

async function DoneMessage({ searchParams }: { searchParams: PageProps<"/admin/library/[id]">["searchParams"] }) {
  const { done } = await searchParams;
  const message = typeof done === "string" ? DONE[done] : undefined;
  if (!message) return null;
  return <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">{message}</p>;
}

export default function AdminLibraryDetailPage({ params, searchParams }: PageProps<"/admin/library/[id]">) {
  return (
    <AdminShell current="/admin/library">
      <Link href="/admin/library" className="flex min-h-11 items-center text-base text-primary">
        ‹ 情報集の一覧に戻る
      </Link>
      <Suspense fallback={null}>
        <DoneMessage searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <Detail params={params} />
      </Suspense>
    </AdminShell>
  );
}
