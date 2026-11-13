"use server";

import { siteConfig } from "@/config/site";
import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { EMPLOYEE_NO_PATTERN, employeeNoToEmail } from "@/lib/employee";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Office, Profile } from "@/lib/types";

export type FormState = { ok: boolean; message: string | null };

const MIN_PASSWORD = 8;
const NO_KEY_MESSAGE =
  "管理者用のキー（SUPABASE_SERVICE_ROLE_KEY）が設定されていないため、この操作はできません。";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 社員アカウントを作成する（管理者のみ） */
export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const employeeNo = String(formData.get("employeeNo") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const officeId = String(formData.get("officeId") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "driver";
  const password = String(formData.get("password") ?? "");

  if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) {
    return { ok: false, message: "社員番号は半角の英数字（20文字以内）で入力してください。" };
  }
  if (!fullName || fullName.length > 50) {
    return { ok: false, message: "氏名を入力してください（50文字以内）。" };
  }
  if (officeId && !UUID_PATTERN.test(officeId)) {
    return { ok: false, message: "営業所の選択が正しくありません。" };
  }
  // パスワードは管理者だけに必要（ドライバーは社員番号だけで入る）
  if (role === "admin" && password.length < MIN_PASSWORD) {
    return { ok: false, message: `管理者のパスワードは${MIN_PASSWORD}文字以上にしてください。` };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, message: NO_KEY_MESSAGE };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: employeeNoToEmail(employeeNo),
    // ドライバーには使われないランダムなパスワードを入れておく（パスワードでは入れないようにするため）
    password: role === "admin" ? password : randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (createError || !created.user) {
    const duplicated = createError?.code === "email_exists" || /already/i.test(createError?.message ?? "");
    return {
      ok: false,
      message: duplicated
        ? "この社員番号はすでに登録されています。"
        : "アカウントを作成できませんでした。時間をおいて、もう一度お試しください。",
    };
  }

  // 社員情報はログイン中の管理者として保存する（管理者として登録した場合に、だれが登録したか記録が残る）
  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    employee_no: employeeNo,
    full_name: fullName,
    office_id: officeId || null,
    role,
  });
  if (profileError) {
    // 社員情報を保存できなければ、作りかけのアカウントを消して元に戻す
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: "社員情報を保存できませんでした。もう一度お試しください。" };
  }

  refresh();
  return { ok: true, message: `${fullName}さん（社員番号 ${employeeNo}）を登録しました。` };
}

/** パスワードを再設定する（管理者のみ） */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: `新しいパスワードは${MIN_PASSWORD}文字以上にしてください。` };
  }
  // 社員として登録されている人だけが対象
  const { data: target } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!target) return { ok: false, message: "対象の社員が見つかりません。" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, message: NO_KEY_MESSAGE };

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, message: "パスワードを変更できませんでした。もう一度お試しください。" };
  return { ok: true, message: "パスワードを再設定しました。本人に新しいパスワードを伝えてください。" };
}

/** 社員の権限（ドライバー／管理者）を切り替える（管理者のみ） */
export async function changeRole(userId: string, newRole: "driver" | "admin"): Promise<FormState> {
  const { supabase, profile } = await requireAdmin();
  if (!UUID_PATTERN.test(userId) || (newRole !== "driver" && newRole !== "admin")) {
    return { ok: false, message: "操作が正しくありません。" };
  }
  if (userId === profile.id && newRole !== "admin") {
    return { ok: false, message: "自分自身の管理者権限は外せません。" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId)
    .select("full_name");
  if (error) {
    // データベース側の安全装置（supabase/setup.sql）で止められた場合
    if (error.hint === "self_demote") return { ok: false, message: "自分自身の管理者権限は外せません。" };
    if (error.hint === "last_admin") {
      return { ok: false, message: "管理者が1人もいなくなるため、変更できません。" };
    }
    return { ok: false, message: "権限を変更できませんでした。もう一度お試しください。" };
  }
  if (!data || data.length === 0) return { ok: false, message: "対象の社員が見つかりません。" };

  refresh();
  const name = (data[0] as { full_name: string }).full_name;
  return {
    ok: true,
    message:
      newRole === "admin"
        ? `${name}さんを管理者にしました。管理者用の入口で使うパスワードを「パスワードを設定する」で設定してください。`
        : `${name}さんをドライバーに戻しました。`,
  };
}

/** 社員を利用停止にする・利用を再開する（管理者のみ） */
export async function changeStatus(userId: string, active: boolean): Promise<FormState> {
  const { supabase, profile } = await requireAdmin();
  if (!UUID_PATTERN.test(userId)) return { ok: false, message: "操作が正しくありません。" };
  if (userId === profile.id && !active) return { ok: false, message: "自分自身は利用停止にできません。" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId)
    .select("full_name");
  if (error) {
    if (error.hint === "self_suspend") return { ok: false, message: "自分自身は利用停止にできません。" };
    if (error.hint === "last_admin") {
      return { ok: false, message: "利用中の管理者が1人もいなくなるため、変更できません。" };
    }
    if (error.code === "42703" || error.code === "PGRST204") {
      return { ok: false, message: "データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。" };
    }
    return { ok: false, message: "変更できませんでした。もう一度お試しください。" };
  }
  if (!data || data.length === 0) return { ok: false, message: "対象の社員が見つかりません。" };

  refresh();
  const name = (data[0] as { full_name: string }).full_name;
  return {
    ok: true,
    message: active
      ? `${name}さんの利用を再開しました。また社員番号で入れます。`
      : `${name}さんを退職（利用停止）にしました。この社員番号では入れなくなり、ログイン中のスマホもログアウトされます。「退職者一覧」から再開や完全な削除ができます。`,
  };
}

/** 社員の情報（氏名・社員番号・営業所・会社）を直す（管理者のみ）。既読記録は固定のIDでつながっているので引き継がれる */
export async function editEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const employeeNo = String(formData.get("employeeNo") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const officeId = String(formData.get("officeId") ?? "");
  // 所属会社（src/config/site.ts の選択肢のどれか。1社だけなら欄が出ないので先頭の会社）
  const companyInput = String(formData.get("company") ?? "");
  const company: string = (siteConfig.companies as readonly string[]).includes(companyInput) ? companyInput : siteConfig.companies[0];

  if (!UUID_PATTERN.test(userId)) return { ok: false, message: "対象の社員が見つかりません。" };
  if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) {
    return { ok: false, message: "社員番号は半角の英数字とハイフン（20文字以内）で入力してください。" };
  }
  if (!fullName || fullName.length > 50) return { ok: false, message: "氏名を入力してください（50文字以内）。" };
  if (!UUID_PATTERN.test(officeId)) return { ok: false, message: "営業所を選んでください。" };

  const { data: target } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  if (!target) return { ok: false, message: "対象の社員が見つかりません。" };
  const { data: office } = await supabase.from("offices").select("id, name").eq("id", officeId).maybeSingle<Office>();
  if (!office) return { ok: false, message: "営業所が見つかりません。" };

  // 社員番号が他の人と重なっていないか（大文字・小文字の違いも同じ番号とみなす）
  const { data: same } = await supabase
    .from("profiles")
    .select("id, full_name")
    .ilike("employee_no", employeeNo)
    .neq("id", userId);
  if (same && same.length > 0) {
    return { ok: false, message: `社員番号「${employeeNo}」は、すでに${(same[0] as { full_name: string }).full_name}さんが使っています。` };
  }

  const numberChanged = (target.employee_no ?? "") !== employeeNo;
  const admin = createAdminClient();
  let oldEmail: string | null = null;
  if (numberChanged) {
    // 社員番号で入るためのログイン情報も、新しい番号に合わせる（メールアドレスで入る管理者はそのまま）
    if (!admin) return { ok: false, message: NO_KEY_MESSAGE };
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser.user?.email ?? "";
    if (email.endsWith("@driver.invalid")) {
      oldEmail = email;
      const { error } = await admin.auth.admin.updateUserById(userId, { email: employeeNoToEmail(employeeNo), email_confirm: true });
      if (error) {
        return {
          ok: false,
          message:
            error.code === "email_exists"
              ? `社員番号「${employeeNo}」のログイン情報がすでにあります。別の番号にしてください。`
              : "社員番号を変更できませんでした。もう一度お試しください。",
        };
      }
    }
  }

  // 社員情報はログイン中の管理者として保存する（変更記録に「だれが」が残るように）
  const { error } = await supabase
    .from("profiles")
    .update({ employee_no: employeeNo, full_name: fullName, office_id: officeId, company })
    .eq("id", userId);
  if (error) {
    if (oldEmail && admin) await admin.auth.admin.updateUserById(userId, { email: oldEmail, email_confirm: true });
    if (error.code === "23505") return { ok: false, message: `社員番号「${employeeNo}」は、すでに他の社員が使っています。` };
    if (error.code === "42703" || error.code === "PGRST204") {
      return { ok: false, message: "データベースの設定（supabase/setup.sql）がまだのようです。" };
    }
    return { ok: false, message: "保存できませんでした。もう一度お試しください。" };
  }

  refresh();
  return {
    ok: true,
    message: numberChanged
      ? `保存しました。${fullName}さんは、これから社員番号「${employeeNo}」で入ります。これまでの既読記録はそのまま引き継がれます。`
      : "保存しました。",
  };
}

/** 退職（利用停止）にした社員を完全に削除する（管理者のみ）。既読記録も消える */
export async function deleteEmployee(userId: string): Promise<FormState> {
  const { supabase, profile } = await requireAdmin();
  if (!UUID_PATTERN.test(userId)) return { ok: false, message: "操作が正しくありません。" };
  if (userId === profile.id) return { ok: false, message: "自分自身は削除できません。" };

  const { data: target } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  if (!target) return { ok: false, message: "対象の社員が見つかりません。" };
  if (target.is_active !== false) {
    return { ok: false, message: "完全に削除できるのは、退職（利用停止）にした社員だけです。" };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: NO_KEY_MESSAGE };

  // 1. 社員情報をログイン中の管理者として削除（だれが削除したかの記録が残る。既読記録も一緒に消える）
  const { data: deleted, error } = await supabase.from("profiles").delete().eq("id", userId).select("id");
  if (error) {
    if (error.hint === "active_delete") return { ok: false, message: "利用中の社員は削除できません。先に退職（利用停止）にしてください。" };
    if (error.hint === "self_delete") return { ok: false, message: "自分自身は削除できません。" };
    return { ok: false, message: "削除できませんでした。もう一度お試しください。" };
  }
  if (!deleted || deleted.length === 0) return { ok: false, message: "削除できませんでした。もう一度お試しください。" };

  // 2. ログイン用のアカウントも消す
  await admin.auth.admin.deleteUser(userId);

  refresh();
  return { ok: true, message: `${target.full_name}さんを完全に削除しました。削除の記録は「変更記録」に残っています。` };
}
