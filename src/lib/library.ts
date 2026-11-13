// 情報集の読み出し（サーバー側だけで使う）
import "server-only";
import { cache } from "react";
import { requireProfile } from "./auth";

export type LibraryGenre = { id: string; name: string; sort_order: number };

export type LibraryItem = {
  id: string;
  genre_id: string;
  title: string;
  body: string | null;
  photo_paths: string[];
  pdf_path: string | null;
  pdf_name: string | null;
  content_updated_at: string;
  created_at: string;
  hidden_at: string | null;
  is_dummy?: boolean;
  /** 「内容を確認しました」ボタンを付ける資料（supabase/setup.sql 実行前は無い） */
  requires_confirm?: boolean;
};

/**
 * まだ開いていない新しい資料は「新着」、開いたあとに内容が更新された資料は「更新」。
 * 確認ボタンのある資料は、最新の内容で「内容を確認しました」を押すまで「未確認」
 */
export type LibraryMark = "new" | "updated" | "unconfirmed" | null;

export const MARK_LABEL: Record<Exclude<LibraryMark, null>, string> = { new: "新着", updated: "更新", unconfirmed: "未確認" };

type ViewRow = { item_id: string; viewed_at: string; confirmed_at?: string | null };

/** 自分の記録から、資料の印を決める */
export function markOf(item: LibraryItem, view: ViewRow | undefined): LibraryMark {
  if (item.requires_confirm) {
    return view?.confirmed_at && view.confirmed_at >= item.content_updated_at ? null : "unconfirmed";
  }
  return !view ? "new" : view.viewed_at < item.content_updated_at ? "updated" : null;
}

export type LibrarySummary = LibraryItem & { genreName: string; mark: LibraryMark };

export const LIBRARY_BUCKET = "library-files";

/** 情報集の一覧（新しく登録・更新された順）。情報集の仕組み（supabase/setup.sql）がまだ無ければ null */
export const getLibrary = cache(async function getLibrary(): Promise<{ genres: LibraryGenre[]; items: LibrarySummary[] } | null> {
  const { supabase, profile } = await requireProfile();
  const [genresRes, itemsRes, viewsRes] = await Promise.all([
    supabase.from("library_genres").select("id, name, sort_order").order("sort_order"),
    supabase.from("library_items").select("*").is("hidden_at", null).order("content_updated_at", { ascending: false }),
    // "*" にしておくと、確認の列（supabase/setup.sql）がまだ無くてもエラーにならない
    supabase.from("library_views").select("*").eq("user_id", profile.id),
  ]);
  if (genresRes.error || itemsRes.error || viewsRes.error) return null;
  const genres = genresRes.data as LibraryGenre[];
  const genreName = new Map(genres.map((g) => [g.id, g.name]));
  const views = new Map((viewsRes.data as ViewRow[]).map((v) => [v.item_id, v]));
  const items = (itemsRes.data as LibraryItem[]).map((item) => ({
    ...item,
    genreName: genreName.get(item.genre_id) ?? "",
    mark: markOf(item, views.get(item.id)),
  }));
  return { genres, items };
});

export function unseenCount(items: LibrarySummary[]): number {
  return items.filter((i) => i.mark !== null).length;
}

/** 資料1件（写真・PDFは期限付きの表示用URLにする。自分が最新の内容を確認済みかどうか付き） */
export async function getLibraryItem(id: string) {
  const { supabase, profile } = await requireProfile();
  const [{ data: item }, { data: view }] = await Promise.all([
    supabase.from("library_items").select("*").eq("id", id).maybeSingle<LibraryItem>(),
    supabase.from("library_views").select("*").eq("item_id", id).eq("user_id", profile.id).maybeSingle<ViewRow>(),
  ]);
  if (!item) return null;
  const confirmed = Boolean(item.requires_confirm && view?.confirmed_at && view.confirmed_at >= item.content_updated_at);
  const [{ data: genre }, photos, pdf] = await Promise.all([
    supabase.from("library_genres").select("id, name, sort_order").eq("id", item.genre_id).maybeSingle<LibraryGenre>(),
    item.photo_paths.length
      ? supabase.storage.from(LIBRARY_BUCKET).createSignedUrls(item.photo_paths, 60 * 60)
      : Promise.resolve({ data: [] as { signedUrl: string | null; path: string | null }[] }),
    item.pdf_path
      ? supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(item.pdf_path, 60 * 60, { download: item.pdf_name ?? true })
      : Promise.resolve({ data: null }),
  ]);
  // PDF は画面で開く用と、保存する用の2つ
  const pdfView = item.pdf_path ? await supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(item.pdf_path, 60 * 60) : null;
  return {
    item,
    confirmed,
    genreName: genre?.name ?? "",
    photoUrls: (photos.data ?? []).map((p) => p.signedUrl).filter((u): u is string => Boolean(u)),
    pdfUrl: pdfView?.data?.signedUrl ?? null,
    pdfDownloadUrl: pdf.data?.signedUrl ?? null,
  };
}
