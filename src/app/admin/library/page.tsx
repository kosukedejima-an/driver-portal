import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { RateBar } from "@/components/RateBar";
import { requireAdmin } from "@/lib/auth";
import { formatDate, rate } from "@/lib/format";
import type { LibraryGenre, LibraryItem } from "@/lib/library";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function AdminLibraryList({ searchParams }: { searchParams: PageProps<"/admin/library">["searchParams"] }) {
  const sp = await searchParams;
  const genre = typeof sp.genre === "string" && UUID_PATTERN.test(sp.genre) ? sp.genre : "";
  const { supabase } = await requireAdmin();
  let query = supabase.from("library_items").select("*").order("content_updated_at", { ascending: false }).limit(100);
  if (genre) query = query.eq("genre_id", genre);
  const [genresRes, itemsRes, driversRes] = await Promise.all([
    supabase.from("library_genres").select("id, name, sort_order").order("sort_order"),
    query,
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "driver").eq("is_active", true),
  ]);
  if (genresRes.error || itemsRes.error) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。
      </p>
    );
  }
  const genres = genresRes.data as LibraryGenre[];
  const items = itemsRes.data as LibraryItem[];
  const total = driversRes.count ?? 0;
  const genreName = new Map(genres.map((g) => [g.id, g.name]));
  // 最新の内容を開いた人数（利用中のドライバーだけ）
  const viewed = await Promise.all(
    items.map((i) =>
      supabase
        .from("library_views")
        .select("item_id, profiles!inner(role, is_active)", { count: "exact", head: true })
        .eq("item_id", i.id)
        // 確認ボタンのある資料は「確認を押した人」、ない資料は「開いた人」
        .gte(i.requires_confirm ? "confirmed_at" : "viewed_at", i.content_updated_at)
        .eq("profiles.role", "driver")
        .eq("profiles.is_active", true)
        .then((r) => r.count ?? 0),
    ),
  );

  return (
    <>
      <nav aria-label="ジャンル" className="-mx-4 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-2">
          {[{ id: "", name: "すべて" }, ...genres].map((g) => (
            <li key={g.id || "all"}>
              <Link
                href={g.id ? `/admin/library?genre=${g.id}` : "/admin/library"}
                aria-current={genre === g.id ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap ${
                  genre === g.id ? "border-primary bg-primary font-bold text-white" : "border-gray-300 bg-white text-primary"
                }`}
              >
                {g.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {items.length === 0 ? (
        <p className="py-8 text-center text-base text-gray-600">資料はまだありません。</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((i, k) => (
            <li key={i.id}>
              <Link href={`/admin/library/${i.id}`} className="block h-full rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">{genreName.get(i.genre_id)}</span>
                  {i.hidden_at && <span className="rounded bg-gray-600 px-2 py-0.5 text-sm font-bold text-white">非表示中</span>}
                  {i.requires_confirm && <span className="rounded border border-primary px-2 py-0.5 text-sm font-bold text-primary">確認ボタンあり</span>}
                  {i.is_dummy && <DummyBadge />}
                </div>
                <h2 className="mt-2 text-base font-bold leading-snug">{i.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{formatDate(i.content_updated_at)} 更新</p>
                <div className="mt-3 flex items-center gap-3">
                  <RateBar read={viewed[k]} total={total} />
                  <span className="shrink-0 text-sm font-bold">
                    {i.requires_confirm ? "確認" : "閲覧"} {viewed[k]}/{total}人（{rate(viewed[k], total)}%）
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function DoneMessage({ searchParams }: { searchParams: PageProps<"/admin/library">["searchParams"] }) {
  const { done } = await searchParams;
  if (done !== "deleted") return null;
  return <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">資料を完全に削除しました。</p>;
}

export default function AdminLibraryPage({ searchParams }: PageProps<"/admin/library">) {
  return (
    <AdminShell current="/admin/library">
      <Suspense fallback={null}>
        <DoneMessage searchParams={searchParams} />
      </Suspense>
      <div className="grid grid-cols-2 gap-2 lg:max-w-xl">
        <Link href="/admin/library/new" className="flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
          ＋ 資料を登録
        </Link>
        <Link href="/admin/library/genres" className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary bg-white text-base font-bold text-primary">
          ジャンルの管理
        </Link>
      </div>
      <p className="text-sm text-gray-600">閲覧は「最新の内容を開いた、利用中のドライバー」の人数です。確認ボタンのある資料は「内容を確認しました」を押した人数です。</p>
      <Suspense fallback={<Loading />}>
        <AdminLibraryList searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}
