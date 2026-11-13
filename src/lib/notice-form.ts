// お知らせの投稿・編集フォームの内容を確認し、保存できる形にする（サーバー側で使う）
import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES, type Category } from "./types";

const MAX_PHOTO_BYTES = 3.5 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function text(formData: FormData, name: string, max: number): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export type NoticeFields = {
  category: Category;
  title: string;
  author_label: string;
  body: string | null;
  accident_situation: string | null;
  accident_cause: string | null;
  accident_prevention: string | null;
  photo_caption: string | null;
};

export type ParsedNoticeForm =
  | { error: string }
  | { error: null; fields: NoticeFields; photo: File | null; removePhoto: boolean };

export function parseNoticeForm(formData: FormData): ParsedNoticeForm {
  const category = String(formData.get("category") ?? "") as Category;
  if (!CATEGORIES.includes(category)) return { error: "カテゴリを選んでください。" };

  const title = text(formData, "title", 100);
  const authorLabel = text(formData, "authorLabel", 50);
  const body = text(formData, "body", 5000);
  const situation = text(formData, "situation", 3000);
  const cause = text(formData, "cause", 3000);
  const prevention = text(formData, "prevention", 3000);

  if (!title) return { error: "タイトルを入力してください。" };
  if (!authorLabel) return { error: "投稿者を入力してください。" };
  const isAccident = category === "事故速報";
  if (isAccident && (!situation || !cause || !prevention)) {
    return { error: "事故速報は「発生状況」「原因」「再発防止」をすべて入力してください。" };
  }
  if (!isAccident && !body) return { error: "本文を入力してください。" };

  const photoInput = formData.get("photo");
  const photo = photoInput instanceof File && photoInput.size > 0 ? photoInput : null;
  if (photo) {
    if (!PHOTO_TYPES[photo.type]) return { error: "写真は JPEG・PNG・WebP の画像を選んでください。" };
    if (photo.size > MAX_PHOTO_BYTES) return { error: "写真のサイズが大きすぎます。" };
  }

  return {
    error: null,
    fields: {
      category,
      title,
      author_label: authorLabel,
      body: body || null,
      accident_situation: isAccident ? situation : null,
      accident_cause: isAccident ? cause : null,
      accident_prevention: isAccident ? prevention : null,
      photo_caption: text(formData, "photoCaption", 100) || null,
    },
    photo,
    removePhoto: formData.get("removePhoto") === "on",
  };
}

/** 写真を保存し、保存先の名前を返す */
export async function uploadPhoto(supabase: SupabaseClient, photo: File): Promise<string | null> {
  const path = `${randomUUID()}.${PHOTO_TYPES[photo.type]}`;
  const { error } = await supabase.storage
    .from("notice-photos")
    .upload(path, photo, { contentType: photo.type });
  return error ? null : path;
}

export async function removePhoto(supabase: SupabaseClient, path: string | null) {
  if (path) await supabase.storage.from("notice-photos").remove([path]);
}
