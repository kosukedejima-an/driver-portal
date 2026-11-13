import "server-only";
import { cache } from "react";
import { requireProfile } from "./auth";
import type { Category, Notice, NoticeSummary } from "./types";

/**
 * 公開中のお知らせ（新しい順）と、自分が確認済みのお知らせのID。
 * ホームの一覧・メニューの数字・タイムラインで共有し、1回の画面表示では1回だけ取りに行く（cache）。
 */
export const getVisibleNotices = cache(async function getVisibleNotices(): Promise<{ notices: Notice[]; readIds: Set<string> }> {
  const { supabase, profile } = await requireProfile();
  const [noticesRes, readsRes] = await Promise.all([
    supabase
      .from("notices")
      // "*" にしておくと、ダミーの印（is_dummy）の列がまだ無くてもエラーにならない
      .select("*")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false }),
    supabase.from("notice_reads").select("notice_id").eq("user_id", profile.id),
  ]);
  if (noticesRes.error) throw noticesRes.error;
  if (readsRes.error) throw readsRes.error;
  return {
    // 非表示のお知らせは出さない（ドライバーにはデータベース側でも見えない）
    notices: (noticesRes.data as Notice[]).filter((n) => !n.hidden_at),
    readIds: new Set(readsRes.data.map((r) => r.notice_id as string)),
  };
});

/** お知らせ一覧（自分が確認済みかどうか付き。未読が上、その中は新しい順） */
export async function getNoticeSummaries(category?: Category): Promise<NoticeSummary[]> {
  const { notices, readIds } = await getVisibleNotices();
  return notices
    .filter((n) => !category || n.category === category)
    .map((n) => ({
      id: n.id,
      category: n.category,
      title: n.title,
      published_at: n.published_at,
      is_dummy: n.is_dummy,
      isRead: readIds.has(n.id),
    }))
    // 未読を上に。同じ中では新しい順（データベースから新しい順で届く並びを保つ）
    .sort((a, b) => Number(a.isRead) - Number(b.isRead));
}

/** お知らせ1件（写真の表示用URLと、自分が確認済みかどうか付き） */
export async function getNoticeDetail(id: string) {
  const { supabase, profile } = await requireProfile();
  // お知らせと自分の確認記録は、同時に取りに行く
  const [noticeRes, readRes] = await Promise.all([
    supabase.from("notices").select("*").eq("id", id).maybeSingle<Notice>(),
    supabase.from("notice_reads").select("read_at").eq("notice_id", id).eq("user_id", profile.id).maybeSingle<{ read_at: string }>(),
  ]);
  if (noticeRes.error) throw noticeRes.error;
  const notice = noticeRes.data;
  if (!notice) return null;
  const photo = notice.photo_path
    ? await supabase.storage.from("notice-photos").createSignedUrl(notice.photo_path, 60 * 60)
    : null;
  return {
    notice,
    readAt: readRes.data?.read_at ?? null,
    photoUrl: photo?.data?.signedUrl ?? null,
  };
}
