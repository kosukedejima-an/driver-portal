"use server";

// 配車表の掲載・差し替え・削除（管理者のみ。権限はデータベース側でも確認している）
import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DISPATCH_BUCKET } from "@/lib/dispatch";
import { DATE_PATTERN, formatSheetDate } from "@/lib/dispatch-date";
import { notifyDispatch } from "@/lib/push";
import { getSiteUrl } from "@/lib/site-url";

export type DispatchResult = { ok: boolean; message: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_PATTERN = /^[0-9a-f-]{36}\.pdf$/;
const MAX_BYTES = 20 * 1024 * 1024;
const NEED_SETUP = "データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。";

/** PDF を置くための使い捨ての受け付け番号を出す（PDFはブラウザから置き場所へ直接送る） */
export async function prepareDispatchUpload(file: { type: string; size: number }): Promise<{ path: string; token: string } | { error: string }> {
  const { supabase } = await requireAdmin();
  if (file.type !== "application/pdf") return { error: "PDFファイルを選んでください。" };
  if (file.size > MAX_BYTES) return { error: "PDFは20MBまでです。" };
  const path = `${randomUUID()}.pdf`;
  const { data, error } = await supabase.storage.from(DISPATCH_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "PDFを送る準備ができませんでした。" + (error ? `（${NEED_SETUP}）` : "") };
  return { path, token: data.token };
}

/** 配車表を載せる（同じ日付があれば差し替え）。載せたら全員に通知する */
export async function saveDispatchSheet(input: { date: string; path: string; name: string }): Promise<DispatchResult> {
  const { supabase, profile } = await requireAdmin();
  if (!DATE_PATTERN.test(input.date) || Number.isNaN(Date.parse(input.date))) return { ok: false, message: "日付を選んでください。" };
  if (!PATH_PATTERN.test(input.path)) return { ok: false, message: "PDFを選んでください。" };
  const name = String(input.name ?? "").slice(0, 200) || "配車表.pdf";

  const { data: before, error: readError } = await supabase
    .from("dispatch_sheets")
    .select("id, pdf_path")
    .eq("sheet_date", input.date)
    .maybeSingle<{ id: string; pdf_path: string }>();
  if (readError) return { ok: false, message: readError.code === "42P01" ? NEED_SETUP : "保存できませんでした。" };

  const now = new Date().toISOString();
  const { error } = before
    ? await supabase.from("dispatch_sheets").update({ pdf_path: input.path, pdf_name: name, updated_at: now, updated_by: profile.id }).eq("id", before.id)
    : await supabase.from("dispatch_sheets").insert({ sheet_date: input.date, pdf_path: input.path, pdf_name: name, created_by: profile.id });
  if (error) return { ok: false, message: "保存できませんでした。もう一度お試しください。" };
  // 差し替えたときは、古いPDFを片付ける
  if (before) await supabase.storage.from(DISPATCH_BUCKET).remove([before.pdf_path]);

  const title = formatSheetDate(input.date);
  const siteUrl = await getSiteUrl();
  after(() => notifyDispatch(title, before ? "update" : "new", siteUrl));
  refresh();
  return { ok: true, message: `${title}の配車表を${before ? "差し替え" : "掲載し"}ました。社員のスマホに通知を送っています。` };
}

/** 配車表を消す（PDFも消える） */
export async function deleteDispatchSheet(id: string): Promise<DispatchResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "配車表が見つかりません。" };
  const { data, error } = await supabase.from("dispatch_sheets").delete().eq("id", id).select("pdf_path");
  if (error || !data?.length) return { ok: false, message: "削除できませんでした。" };
  await supabase.storage.from(DISPATCH_BUCKET).remove([(data[0] as { pdf_path: string }).pdf_path]);
  refresh();
  return { ok: true, message: "配車表を削除しました。" };
}
