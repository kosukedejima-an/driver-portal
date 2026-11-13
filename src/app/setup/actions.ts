"use server";

// はじめの設定：最初の管理者を作る。管理者がまだ1人もいないときだけ動く
import { redirect } from "next/navigation";
import { EMPLOYEE_NO_PATTERN, employeeNoToEmail } from "@/lib/employee";
import { createAdminClient } from "@/lib/supabase/admin";

export type SetupState = { error: string | null };

/** 管理者がもういるか（いれば、はじめの設定は使えない） */
export async function hasAdmin(): Promise<boolean | "no-key" | "no-db"> {
  const admin = createAdminClient();
  if (!admin) return "no-key";
  const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if (error) return "no-db";
  return (count ?? 0) > 0;
}

export async function createFirstAdmin(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const admin = createAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY が登録されていません。" };
  const state = await hasAdmin();
  if (state === true) return { error: "管理者はすでに登録されています。管理者ログインから入ってください。" };
  if (state !== false) return { error: "データベースの設定（supabase/setup.sql）がまだのようです。" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const employeeNo = String(formData.get("employeeNo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!fullName || fullName.length > 50) return { error: "氏名を入力してください（50文字以内）。" };
  if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) return { error: "社員番号は半角の英数字とハイフン（20文字以内）で入力してください。" };
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください。" };

  const { data: office } = await admin.from("offices").select("id").order("sort_order").limit(1).maybeSingle<{ id: string }>();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: employeeNoToEmail(employeeNo),
    password,
    email_confirm: true,
  });
  if (error || !created.user) return { error: "管理者を作れませんでした。もう一度お試しください。" };
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, full_name: fullName, employee_no: employeeNo, role: "admin", office_id: office?.id ?? null });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "管理者を作れませんでした。もう一度お試しください。" };
  }
  redirect("/login/admin?setup=done");
}
