"use server";

import { redirect } from "next/navigation";
import { EMPLOYEE_NO_PATTERN, loginIdToEmail } from "@/lib/employee";
import { getClientIp, isLockedOut, LOCKED_MESSAGE, recordAttempt } from "@/lib/login";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type LoginState = { error: string | null };

const UNAVAILABLE = "現在ログインできません。管理者に連絡してください。";

/**
 * ドライバー用：社員番号だけで入る。
 * この入り方では、管理者の社員でも管理者画面は使えない（データベース側で判定）。
 */
export async function driverLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const employeeNo = String(formData.get("employeeNo") ?? "").trim();
  if (!employeeNo) return { error: "社員番号を入力してください。" };

  const admin = createAdminClient();
  if (!admin) return { error: UNAVAILABLE };
  const ip = await getClientIp();
  if (await isLockedOut(admin, ip)) return { error: LOCKED_MESSAGE };

  const fail = async () => {
    await recordAttempt(admin, { ip, loginId: employeeNo, method: "number", success: false });
    return { error: "この社員番号では入れません。番号を確かめるか、管理者に連絡してください。" };
  };
  if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) return fail();

  // 社員番号から社員を探す（大文字・小文字は区別しない）。利用停止中は入れない
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .ilike("employee_no", employeeNo)
    .maybeSingle<Profile>();
  if (!profile || profile.is_active === false) return fail();

  const { data: userData } = await admin.auth.admin.getUserById(profile.id);
  const email = userData.user?.email;
  if (!email) return fail();

  // サーバーの中だけで使い捨ての合い鍵を作り、その場でログイン状態にする（メールは送らない）
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties?.hashed_token) return { error: UNAVAILABLE };
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) return { error: UNAVAILABLE };

  await recordAttempt(admin, { ip, loginId: employeeNo, method: "number", success: true, userId: profile.id });
  redirect("/");
}

/** 管理者用：社員番号（またはメールアドレス）とパスワードで入る */
export async function adminLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const email = loginIdToEmail(loginId);
  if (!email || !password) return { error: "社員番号とパスワードを入力してください。" };

  const admin = createAdminClient();
  const ip = await getClientIp();
  if (admin && (await isLockedOut(admin, ip))) return { error: LOCKED_MESSAGE };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (admin) await recordAttempt(admin, { ip, loginId, method: "password", success: false });
    return { error: "社員番号またはパスワードが違います。" };
  }

  // 管理者として使えるか（管理者で、利用中で、パスワードで入っている）をデータベースに確かめる
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    if (admin) await recordAttempt(admin, { ip, loginId, method: "password", success: false, userId: data.user.id });
    return { error: "管理者用の入口です。ドライバーの方は、前の画面から社員番号だけで入ってください。" };
  }

  if (admin) await recordAttempt(admin, { ip, loginId, method: "password", success: true, userId: data.user.id });
  redirect("/admin/reads");
}
