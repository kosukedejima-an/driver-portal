import Link from "next/link";
import { Suspense } from "react";
import { DriverShell } from "@/components/DriverShell";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { formatDate } from "@/lib/format";
import { MARK_LABEL, getLibrary, unseenCount } from "@/lib/library";

async function LibraryList({ searchParams }: { searchParams: PageProps<"/library">["searchParams"] }) {
  const sp = await searchParams;
  const genre = typeof sp.genre === "string" ? sp.genre : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 30) : "";
  const data = await getLibrary();
  if (!data) return <p className="py-8 text-center text-base text-gray-600">情報集はまだ使えません。</p>;

  const items = data.items.filter((i) => (!genre || i.genre_id === genre) && (!q || i.title.includes(q)));
  const unseen = unseenCount(data.items);
  const href = (g: string) => {
    const p = new URLSearchParams();
    if (g) p.set("genre", g);
    if (q) p.set("q", q);
    return `/library${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <form action="/library" method="get" className="flex gap-2">
        {genre && <input type="hidden" name="genre" value={genre} />}
        <label className="flex-1">
          <span className="sr-only">題名で検索</span>
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="題名で検索"
            className="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base"
          />
        </label>
        <button type="submit" className="min-h-12 shrink-0 rounded-lg bg-primary px-4 text-base font-bold text-white">
          検索
        </button>
      </form>

      {/* ジャンル（スマホでは横にスクロール） */}
      <nav aria-label="ジャンル" className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-2">
          {[{ id: "", name: "すべて" }, ...data.genres].map((g) => (
            <li key={g.id || "all"}>
              <Link
                href={href(g.id)}
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

      {unseen > 0 && !genre && !q && <p className="mt-3 text-base font-bold text-unread">新着・更新・未確認 {unseen}件</p>}
      {q && <p className="mt-3 text-sm text-gray-600">「{q}」の検索結果：{items.length}件</p>}

      {items.length === 0 ? (
        <p className="py-8 text-center text-base text-gray-600">該当する資料はありません。</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/library/${i.id}`} className={`block rounded-lg bg-white p-4 ${i.mark ? "border-2 border-unread" : "border border-gray-200"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">{i.genreName}</span>
                  {i.mark && <span className="text-sm font-bold text-unread">● {MARK_LABEL[i.mark]}</span>}
                  {i.requires_confirm && !i.mark && <span className="text-sm text-gray-600">確認済み</span>}
                  {i.pdf_path && <span className="text-sm text-gray-600">PDFあり</span>}
                  {i.is_dummy && <DummyBadge />}
                </div>
                <h3 className="mt-2 text-base font-bold leading-snug">{i.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{formatDate(i.content_updated_at)} 更新</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <DriverShell title="情報集">
      <Suspense fallback={<Loading />}>
        <LibraryList searchParams={searchParams} />
      </Suspense>
    </DriverShell>
  );
}
