export const CATEGORIES = ["事故速報", "安全・運行", "社内報", "総務"] as const;
export type Category = (typeof CATEGORIES)[number];

/** カテゴリごとの画面のアドレス（例：/categories/accident） */
export const CATEGORY_SLUGS: Record<Category, string> = {
  事故速報: "accident",
  "安全・運行": "safety",
  社内報: "newsletter",
  総務: "general",
};

export function categoryFromSlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => CATEGORY_SLUGS[c] === slug);
}

export type Role = "driver" | "admin";

export type Profile = {
  id: string;
  employee_no: string | null;
  full_name: string;
  office_id: string | null;
  role: Role;
  /** ダミーデータの印（supabase/setup.sql 実行前は無い） */
  is_dummy?: boolean;
  /** false = 利用停止中（supabase/setup.sql 実行前は無い） */
  is_active?: boolean;
};

export type Office = { id: string; name: string };

export type Notice = {
  id: string;
  category: Category;
  title: string;
  body: string | null;
  accident_situation: string | null;
  accident_cause: string | null;
  accident_prevention: string | null;
  photo_path: string | null;
  photo_caption: string | null;
  author_label: string;
  published_at: string;
  /** ダミーデータの印（supabase/setup.sql 実行前は無い） */
  is_dummy?: boolean;
  /** 非表示にした日時（supabase/setup.sql 実行前は無い） */
  hidden_at?: string | null;
  updated_at?: string | null;
};

export type AuditAction = "create" | "edit" | "hide" | "unhide" | "delete";

/** お知らせの操作記録 */
export type AuditLog = {
  id: number;
  notice_id: string;
  notice_title: string;
  action: AuditAction;
  changed_fields: string[] | null;
  actor_name: string | null;
  created_at: string;
};

/** 一覧表示用（自分が確認済みかどうか付き） */
export type NoticeSummary = Pick<Notice, "id" | "category" | "title" | "published_at" | "is_dummy"> & {
  isRead: boolean;
};
