import type { AuditAction } from "./types";

export const ACTION_LABELS: Record<AuditAction, string> = {
  create: "投稿",
  edit: "編集",
  hide: "非表示",
  unhide: "再表示",
  delete: "完全削除",
};

export const FIELD_LABELS: Record<string, string> = {
  category: "カテゴリ",
  title: "タイトル",
  author_label: "投稿者",
  body: "本文",
  accident_situation: "発生状況",
  accident_cause: "原因",
  accident_prevention: "再発防止",
  photo_path: "写真",
  photo_caption: "写真の説明",
};
