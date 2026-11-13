// タイムライン：お知らせとアンケートを新しい順に並べる（サーバー側だけで使う）
import "server-only";
import { requireProfile } from "./auth";
import type { InstagramKind, InstagramPost } from "./instagram";
import { getVisibleNotices } from "./queries";
import { getSurveySummaries } from "./surveys";
import type { Category, Notice } from "./types";

export type LikeTarget = "notice" | "survey" | "instagram";

export type TimelineItem = {
  type: LikeTarget;
  id: string;
  title: string;
  date: string;
  /** お知らせはカテゴリ、アンケートは「アンケート」、インスタは「Instagram」 */
  label: Category | "アンケート" | "Instagram";
  author: string | null;
  excerpt: string | null;
  photoUrl: string | null;
  /** 未確認・未回答なら true（赤で目立たせる） */
  todo: boolean;
  statusText: string;
  likes: number;
  liked: boolean;
  isDummy: boolean;
  /** Instagram の投稿のときだけ：埋め込む投稿 */
  instagram?: { kind: InstagramKind; shortcode: string };
};

export type LikeInfo = { enabled: boolean; counts: Map<string, number>; mine: Set<string> };

/** 投稿ごとのいいねの数と、自分がいいねしたか。いいねの仕組み（supabase/setup.sql）がまだ無ければ enabled=false */
export async function getLikes(type: LikeTarget, ids: string[]): Promise<LikeInfo> {
  const { supabase, profile } = await requireProfile();
  if (ids.length === 0) return { enabled: true, counts: new Map(), mine: new Set() };
  const [countsRes, mineRes] = await Promise.all([
    supabase.rpc("post_like_counts", { p_type: type, p_ids: ids }),
    supabase.from("post_likes").select("target_id").eq("target_type", type).eq("user_id", profile.id).in("target_id", ids),
  ]);
  if (countsRes.error || mineRes.error) return { enabled: false, counts: new Map(), mine: new Set() };
  return {
    enabled: true,
    counts: new Map((countsRes.data as { target_id: string; likes: number }[]).map((c) => [c.target_id, Number(c.likes)])),
    mine: new Set(mineRes.data.map((m) => m.target_id as string)),
  };
}

function excerptOf(n: Notice): string | null {
  const text = (n.category === "事故速報" ? n.accident_situation : n.body) ?? "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat ? (flat.length > 70 ? `${flat.slice(0, 70)}…` : flat) : null;
}

/** タイムラインの投稿（新しい順に limit 件） */
export async function getTimeline(limit: number): Promise<{ items: TimelineItem[]; hasMore: boolean; likesEnabled: boolean }> {
  const { supabase } = await requireProfile();
  // お知らせはホームのメニューの数字と同じものを使う（取りに行くのは1回だけ）
  const [{ notices: allNotices, readIds }, surveys, instagram] = await Promise.all([
    getVisibleNotices(),
    getSurveySummaries(),
    // Instagram の投稿（supabase/setup.sql 実行前は空）
    supabase
      .from("instagram_posts")
      .select("*")
      .is("hidden_at", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(limit + 1)
      .then((r) => (r.error ? [] : (r.data as InstagramPost[]))),
  ]);
  const notices = allNotices.slice(0, limit + 1);

  const items: TimelineItem[] = [
    ...notices.map<TimelineItem>((n) => ({
      type: "notice",
      id: n.id,
      title: n.title,
      date: n.published_at,
      label: n.category,
      author: n.author_label,
      excerpt: excerptOf(n),
      photoUrl: null, // あとでまとめて入れる
      todo: !readIds.has(n.id),
      statusText: readIds.has(n.id) ? "確認済み" : "未確認",
      likes: 0,
      liked: false,
      isDummy: Boolean(n.is_dummy),
    })),
    ...(surveys ?? []).map<TimelineItem>((s) => ({
      type: "survey",
      id: s.id,
      title: s.title,
      date: s.published_at,
      label: "アンケート",
      author: null,
      excerpt: s.description ? (s.description.length > 70 ? `${s.description.slice(0, 70)}…` : s.description) : null,
      photoUrl: null,
      todo: s.open && !s.answered,
      statusText: s.answered ? "回答済み" : s.open ? "未回答" : "締め切り済み",
      likes: 0,
      liked: false,
      isDummy: Boolean(s.is_dummy),
    })),
    ...instagram.map<TimelineItem>((p) => ({
      type: "instagram",
      id: p.id,
      title: "",
      date: p.published_at,
      label: "Instagram",
      author: null,
      excerpt: p.note,
      photoUrl: null,
      todo: false,
      statusText: "",
      likes: 0,
      liked: false,
      isDummy: Boolean(p.is_dummy),
      instagram: { kind: p.kind, shortcode: p.shortcode },
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit + 1);

  const hasMore = items.length > limit;
  const shown = items.slice(0, limit);

  // 写真の表示用URL（期限付き）といいねの数は、同時に取りに行く
  const photoPaths = notices
    .filter((n) => n.photo_path && shown.some((i) => i.type === "notice" && i.id === n.id))
    .map((n) => n.photo_path as string);
  const idsOf = (type: LikeTarget) => shown.filter((i) => i.type === type).map((i) => i.id);
  const [photosRes, noticeLikes, surveyLikes, instagramLikes] = await Promise.all([
    photoPaths.length ? supabase.storage.from("notice-photos").createSignedUrls(photoPaths, 60 * 60) : Promise.resolve({ data: [] }),
    getLikes("notice", idsOf("notice")),
    getLikes("survey", idsOf("survey")),
    getLikes("instagram", idsOf("instagram")),
  ]);
  const photoUrls = new Map<string, string>();
  for (const d of (photosRes.data ?? []) as { path: string | null; signedUrl: string | null }[]) {
    if (d.path && d.signedUrl) photoUrls.set(d.path, d.signedUrl);
  }
  const photoOf = new Map(notices.map((n) => [n.id, n.photo_path ? photoUrls.get(n.photo_path) ?? null : null]));
  for (const item of shown) if (item.type === "notice") item.photoUrl = photoOf.get(item.id) ?? null;
  for (const item of shown) {
    const info = item.type === "notice" ? noticeLikes : item.type === "survey" ? surveyLikes : instagramLikes;
    item.likes = info.counts.get(item.id) ?? 0;
    item.liked = info.mine.has(item.id);
  }
  return { items: shown, hasMore, likesEnabled: noticeLikes.enabled && surveyLikes.enabled };
}
