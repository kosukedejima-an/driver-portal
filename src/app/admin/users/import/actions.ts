"use server";

// 社員のCSV取り込み（管理者のみ）。ファイルは保存せず、この処理の中でだけ読む。
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { applyPlan, buildPlan, type ApplyResult, type Plan } from "@/lib/employee-import";
import { createAdminClient } from "@/lib/supabase/admin";

export type PreviewResult = { plan: Plan; error: null } | { plan: null; error: string };
export type ImportResult = { result: ApplyResult; error: null } | { result: null; error: string };

function getFile(formData: FormData): File | null {
  const file = formData.get("file");
  return file instanceof File ? file : null;
}

/** 取り込む前の確認：新規・更新・エラーを数えて返す（データベースは変えない） */
export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const { supabase, profile } = await requireAdmin();
  const file = getFile(formData);
  if (!file) return { plan: null, error: "CSVファイルを選んでください。" };
  try {
    const plan = await buildPlan(supabase, file, profile);
    return "error" in plan ? { plan: null, error: plan.error } : { plan, error: null };
  } catch {
    // ファイルの中身を含むおそれがあるため、エラーの詳細は記録しない
    return { plan: null, error: "ファイルを読み取れませんでした。CSV形式か確認してください。" };
  }
}

/** 取り込みを実行する。同じファイルをもう一度確認し直してから保存する（エラーの行は取り込まない） */
export async function commitImport(formData: FormData): Promise<ImportResult> {
  const { supabase, profile } = await requireAdmin();
  const admin = createAdminClient();
  if (!admin) {
    return { result: null, error: "管理者用のキー（SUPABASE_SERVICE_ROLE_KEY）が設定されていないため、取り込めません。" };
  }
  const file = getFile(formData);
  if (!file) return { result: null, error: "CSVファイルを選んでください。" };
  try {
    const plan = await buildPlan(supabase, file, profile);
    if ("error" in plan) return { result: null, error: plan.error };
    const result = await applyPlan(supabase, admin, plan);
    refresh();
    return { result, error: null };
  } catch {
    return { result: null, error: "取り込みの途中で問題が起きました。社員管理で結果を確認してください。" };
  }
}
