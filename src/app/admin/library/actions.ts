"use server";

// 情報集の登録・更新・非表示・完全削除と、ジャンルの管理（管理者のみ。権限はデータベース側でも確認している）
import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { LIBRARY_BUCKET } from "@/lib/library";
import { notifyLibraryItem } from "@/lib/push";
import { getSiteUrl } from "@/lib/site-url";

export type LibraryResult = { ok: boolean; message: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS = 10;
const NEED_SETUP = "データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。";

/**
 * 写真・PDFを置くための、使い捨ての受け付け番号を出す。
 * ファイルはスマホ・PCから直接置き場所へ送る（大きなPDFでも送れるように、サーバーを通さない）
 */
export async function prepareUploads(files: { type: string; size: number }[]): Promise<{ uploads: { path: string; token: string }[] } | { error: string }> {
  const { supabase } = await requireAdmin();
  if (files.length > MAX_PHOTOS + 1) return { error: "ファイルが多すぎます。" };
  const uploads: { path: string; token: string }[] = [];
  for (const f of files) {
    const ext = TYPES[f.type];
    if (!ext) return { error: "写真（JPEG・PNG・WebP）か PDF を選んでください。" };
    if (f.size > MAX_BYTES) return { error: "1つのファイルは20MBまでです。" };
    const path = `${randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from(LIBRARY_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: "ファイルを送る準備ができませんでした。" + (error ? "（supabase/setup.sql が済んでいるか確認してください）" : "") };
    uploads.push({ path, token: data.token });
  }
  return { uploads };
}

export type LibraryInput = {
  id?: string;
  genreId: string;
  title: string;
  body: string;
  photoPaths: string[];
  pdf: { path: string; name: string } | null;
  /** 更新のとき：「更新」として知らせる（印を付けて通知する） */
  notify: boolean;
  /** 「内容を確認しました」ボタンを付ける */
  requireConfirm: boolean;
};

/** 資料を登録・更新する */
export async function saveLibraryItem(input: LibraryInput): Promise<LibraryResult> {
  const { supabase, profile } = await requireAdmin();
  const title = String(input.title ?? "").trim().slice(0, 100);
  if (!title) return { ok: false, message: "題名を入力してください。" };
  if (!UUID_PATTERN.test(input.genreId)) return { ok: false, message: "ジャンルを選んでください。" };
  const photos = (input.photoPaths ?? []).filter((p) => PATH_PATTERN.test(p) && !p.endsWith(".pdf")).slice(0, MAX_PHOTOS);
  const pdf = input.pdf && PATH_PATTERN.test(input.pdf.path) && input.pdf.path.endsWith(".pdf") ? input.pdf : null;
  const body = String(input.body ?? "").trim().slice(0, 20000) || null;
  if (!body && photos.length === 0 && !pdf) return { ok: false, message: "本文・写真・PDFのどれかを入れてください。" };

  const fields = {
    genre_id: input.genreId,
    title,
    body,
    photo_paths: photos,
    pdf_path: pdf?.path ?? null,
    pdf_name: pdf ? String(pdf.name).slice(0, 200) : null,
    // 確認ボタンの列は supabase/setup.sql で増える。まだ無いときに付けようとしたら知らせる
    ...(input.requireConfirm ? { requires_confirm: true } : {}),
  };
  const NEED_CONFIRM_SETUP = "確認ボタンを付けるには、データベースの設定（supabase/setup.sql）が必要です。";
  // 確認ボタンを外すとき（列があるときだけ書き込む）
  const unsetConfirm = async (id: string) => {
    if (input.requireConfirm) return;
    await supabase.from("library_items").update({ requires_confirm: false }).eq("id", id);
  };
  const siteUrl = await getSiteUrl();

  if (!input.id) {
    const { data, error } = await supabase.from("library_items").insert({ ...fields, created_by: profile.id }).select("id").single();
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") return { ok: false, message: NEED_CONFIRM_SETUP };
      return { ok: false, message: error.code === "42P01" ? NEED_SETUP : "保存できませんでした。もう一度お試しください。" };
    }
    after(() => notifyLibraryItem(data.id, "new", siteUrl));
    redirect(`/admin/library/${data.id}?done=created`);
  }

  if (!UUID_PATTERN.test(input.id)) return { ok: false, message: "資料が見つかりません。" };
  const { data: before } = await supabase.from("library_items").select("photo_paths, pdf_path").eq("id", input.id).maybeSingle<{
    photo_paths: string[];
    pdf_path: string | null;
  }>();
  if (!before) return { ok: false, message: "資料が見つかりません。" };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("library_items")
    .update({ ...fields, updated_at: now, updated_by: profile.id, ...(input.notify ? { content_updated_at: now } : {}) })
    .eq("id", input.id);
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return { ok: false, message: NEED_CONFIRM_SETUP };
    return { ok: false, message: "保存できませんでした。もう一度お試しください。" };
  }
  await unsetConfirm(input.id);

  // 使わなくなった写真・PDFを片付ける
  const kept = new Set([...photos, pdf?.path].filter(Boolean));
  const removed = [...before.photo_paths, before.pdf_path].filter((p): p is string => Boolean(p) && !kept.has(p!));
  if (removed.length) await supabase.storage.from(LIBRARY_BUCKET).remove(removed);

  const id = input.id;
  if (input.notify) after(() => notifyLibraryItem(id, "update", siteUrl));
  redirect(`/admin/library/${id}?done=${input.notify ? "updated" : "saved"}`);
}

/** 非表示にする・再表示する */
export async function setLibraryHidden(id: string, hidden: boolean): Promise<LibraryResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "資料が見つかりません。" };
  const { data, error } = await supabase.from("library_items").update({ hidden_at: hidden ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, message: "変更できませんでした。" };
  refresh();
  return { ok: true, message: hidden ? "非表示にしました。ドライバーの画面には出ません。" : "再表示しました。" };
}

/** 完全に削除する（非表示にしたものだけ。写真・PDFも消える） */
export async function deleteLibraryItem(id: string): Promise<LibraryResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "資料が見つかりません。" };
  const { data, error } = await supabase.from("library_items").delete().eq("id", id).select("photo_paths, pdf_path");
  if (error || !data?.length) return { ok: false, message: "削除できませんでした。完全に削除できるのは、非表示にした資料だけです。" };
  const row = data[0] as { photo_paths: string[]; pdf_path: string | null };
  const files = [...row.photo_paths, row.pdf_path].filter((p): p is string => Boolean(p));
  if (files.length) await supabase.storage.from(LIBRARY_BUCKET).remove(files);
  redirect("/admin/library?done=deleted");
}

// ---------------------------------------------------------------------
// ジャンルの管理
// ---------------------------------------------------------------------

export async function addGenre(_prev: LibraryResult, formData: FormData): Promise<LibraryResult> {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!name) return { ok: false, message: "ジャンルの名前を入力してください。" };
  const { data: last } = await supabase.from("library_genres").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("library_genres").insert({ name, sort_order: ((last?.[0]?.sort_order as number) ?? 0) + 1 });
  if (error) return { ok: false, message: error.code === "23505" ? "同じ名前のジャンルがすでにあります。" : "追加できませんでした。" };
  refresh();
  return { ok: true, message: `「${name}」を追加しました。` };
}

export async function renameGenre(_prev: LibraryResult, formData: FormData): Promise<LibraryResult> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!UUID_PATTERN.test(id) || !name) return { ok: false, message: "名前を入力してください。" };
  const { error } = await supabase.from("library_genres").update({ name }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23505" ? "同じ名前のジャンルがすでにあります。" : "変更できませんでした。" };
  refresh();
  return { ok: true, message: "名前を変えました。" };
}

/** 並べ替え（1つ上・1つ下と入れ替える） */
export async function moveGenre(id: string, direction: -1 | 1): Promise<LibraryResult> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("library_genres").select("id, sort_order").order("sort_order");
  const list = (data ?? []) as { id: string; sort_order: number }[];
  const i = list.findIndex((g) => g.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return { ok: false, message: null };
  // 番号を振り直してから入れ替える（同じ番号が並んでいても正しく動くように）
  const ordered = list.map((g) => g.id);
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  await Promise.all(ordered.map((gid, k) => supabase.from("library_genres").update({ sort_order: k + 1 }).eq("id", gid)));
  refresh();
  return { ok: true, message: null };
}

export async function deleteGenre(id: string): Promise<LibraryResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: null };
  const { count } = await supabase.from("library_items").select("id", { count: "exact", head: true }).eq("genre_id", id);
  if ((count ?? 0) > 0) return { ok: false, message: `このジャンルには資料が${count}件あります。先に資料を別のジャンルに移すか、削除してください。` };
  const { error } = await supabase.from("library_genres").delete().eq("id", id);
  if (error) return { ok: false, message: "削除できませんでした。" };
  refresh();
  return { ok: true, message: "ジャンルを削除しました。" };
}
