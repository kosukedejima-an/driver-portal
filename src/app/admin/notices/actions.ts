"use server";

// お知らせの投稿・編集・非表示・再表示・完全削除（管理者のみ）
// 権限はデータベース側（RLS）でも確認している。操作記録はデータベースが自動で残す。
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseNoticeForm, removePhoto, uploadPhoto } from "@/lib/notice-form";
import { notifyNewNotice } from "@/lib/push";
import { getSiteUrl } from "@/lib/site-url";

export type ActionResult = { error: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEED_SETUP =
  "データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。";

/** 新しく投稿する */
export async function createNotice(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireAdmin();
  const parsed = parseNoticeForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  let photoPath: string | null = null;
  if (parsed.photo) {
    photoPath = await uploadPhoto(supabase, parsed.photo);
    if (!photoPath) return { error: "写真を保存できませんでした。もう一度お試しください。" };
  }

  const { data, error } = await supabase
    .from("notices")
    .insert({
      ...parsed.fields,
      photo_path: photoPath,
      photo_caption: photoPath ? parsed.fields.photo_caption : null,
      author_id: profile.id,
    })
    .select("id")
    .single();
  if (error) {
    await removePhoto(supabase, photoPath);
    return { error: "投稿できませんでした。もう一度お試しください。" };
  }
  // 投稿を保存したあと、画面の表示を待たせずに社員のスマホへ通知する
  const siteUrl = await getSiteUrl();
  after(() => notifyNewNotice(data.id, siteUrl));
  redirect(`/admin/reads/${data.id}?done=posted`);
}

/** 投稿済みのお知らせを編集する */
export async function updateNotice(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) return { error: "お知らせが見つかりません。" };

  const { data: current } = await supabase
    .from("notices")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle<{ photo_path: string | null }>();
  if (!current) return { error: "お知らせが見つかりません。削除された可能性があります。" };

  const parsed = parseNoticeForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  // 写真：新しい写真を選んだら差し替え、「写真を外す」なら外す、どちらでもなければそのまま
  let photoPath = current.photo_path;
  if (parsed.photo) {
    photoPath = await uploadPhoto(supabase, parsed.photo);
    if (!photoPath) return { error: "写真を保存できませんでした。もう一度お試しください。" };
  } else if (parsed.removePhoto) {
    photoPath = null;
  }

  const { error } = await supabase
    .from("notices")
    .update({
      ...parsed.fields,
      photo_path: photoPath,
      photo_caption: photoPath ? parsed.fields.photo_caption : null,
    })
    .eq("id", id);
  if (error) {
    if (photoPath !== current.photo_path) await removePhoto(supabase, photoPath);
    return { error: "保存できませんでした。もう一度お試しください。" };
  }
  // 使わなくなった古い写真を片付ける
  if (photoPath !== current.photo_path) await removePhoto(supabase, current.photo_path);

  redirect(`/admin/reads/${id}?done=edited`);
}

async function setHidden(id: string, hidden: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { error: "お知らせが見つかりません。" };
  const { data, error } = await supabase
    .from("notices")
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return { error: NEED_SETUP };
  if (data.length === 0) return { error: "お知らせが見つかりません。" };
  refresh();
  return { error: null };
}

/** 非表示にする（ドライバーの画面から消える。データと既読記録は残る） */
export async function hideNotice(id: string): Promise<ActionResult> {
  return setHidden(id, true);
}

/** 再表示する */
export async function unhideNotice(id: string): Promise<ActionResult> {
  return setHidden(id, false);
}

/** 完全に削除する（非表示にしたものだけ。既読記録も消える） */
export async function deleteNotice(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { error: "お知らせが見つかりません。" };

  const { data: target, error: readError } = await supabase
    .from("notices")
    .select("*") // 05 実行前でもエラーにならないよう全項目を取る
    .eq("id", id)
    .maybeSingle<{ id: string; hidden_at?: string | null; photo_path: string | null }>();
  if (readError) return { error: "お知らせを確認できませんでした。もう一度お試しください。" };
  if (!target) return { error: "お知らせが見つかりません。" };
  if (target.hidden_at === undefined) return { error: NEED_SETUP };
  if (!target.hidden_at) return { error: "完全に削除できるのは、非表示にしたお知らせだけです。" };

  const { data, error } = await supabase.from("notices").delete().eq("id", id).select("id");
  if (error || data.length === 0) return { error: "削除できませんでした。もう一度お試しください。" };
  await removePhoto(supabase, target.photo_path);

  redirect("/admin/hidden?done=deleted");
}
