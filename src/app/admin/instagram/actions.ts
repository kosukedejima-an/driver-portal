"use server";

// Instagram の投稿を載せる・非表示・再表示・完全削除（管理者のみ。権限はデータベース側でも確認している）
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { parseInstagramUrl } from "@/lib/instagram";

export type InstagramResult = { ok: boolean; message: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEED_SETUP = "データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。";

/** 投稿のアドレスを貼って、タイムラインに載せる（通知は送らない） */
export async function addInstagramPost(_prev: InstagramResult, formData: FormData): Promise<InstagramResult> {
  const { supabase, profile } = await requireAdmin();
  const parsed = parseInstagramUrl(String(formData.get("url") ?? ""));
  if (!parsed) {
    return { ok: false, message: "Instagramの投稿のアドレスを貼ってください（例：https://www.instagram.com/p/〇〇〇/）。" };
  }
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const { error } = await supabase
    .from("instagram_posts")
    .insert({ kind: parsed.kind, shortcode: parsed.shortcode, note, created_by: profile.id });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "この投稿はもう載せています（非表示にしたものは、一覧から再表示できます）。" };
    return { ok: false, message: error.code === "42P01" ? NEED_SETUP : "載せられませんでした。もう一度お試しください。" };
  }
  refresh();
  return { ok: true, message: "タイムラインに載せました。" };
}

/** 非表示にする・再表示する */
export async function setInstagramHidden(id: string, hidden: boolean): Promise<InstagramResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "投稿が見つかりません。" };
  const { data, error } = await supabase
    .from("instagram_posts")
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "変更できませんでした。" };
  refresh();
  return { ok: true, message: hidden ? "非表示にしました。タイムラインには出ません。" : "再表示しました。" };
}

/** 完全に削除する（非表示にしたものだけ。いいねも消える） */
export async function deleteInstagramPost(id: string): Promise<InstagramResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "投稿が見つかりません。" };
  const { data, error } = await supabase.from("instagram_posts").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "削除できませんでした。完全に削除できるのは、非表示にした投稿だけです。" };
  redirect("/admin/instagram?done=deleted");
}
