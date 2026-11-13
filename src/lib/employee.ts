// ドライバーは「社員番号＋パスワード」でログインします。
// Supabase のログインはメールアドレス形式が必要なため、社員番号から
// 実際には届かない内部用のアドレス（.invalid は存在しないドメイン）を作って使います。
const EMPLOYEE_EMAIL_DOMAIN = "driver.invalid";

export const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9-]{1,20}$/;

export function employeeNoToEmail(employeeNo: string): string {
  return `${employeeNo.toLowerCase()}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

/** ログイン欄の入力を、Supabase に渡すメールアドレスに変換する（@ を含めば管理者のメールとして扱う） */
export function loginIdToEmail(loginId: string): string | null {
  const id = loginId.trim();
  if (id.includes("@")) return id;
  return EMPLOYEE_NO_PATTERN.test(id) ? employeeNoToEmail(id) : null;
}
