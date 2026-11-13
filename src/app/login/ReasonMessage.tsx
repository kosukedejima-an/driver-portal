const REASONS: Record<string, string> = {
  "no-profile": "このアカウントは社員として登録されていません。管理者に連絡してください。",
  suspended: "この社員番号は利用停止中のため、ログアウトしました。管理者に連絡してください。",
};

/** ログイン画面に移動してきた理由（あれば）を表示する */
export async function ReasonMessage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { reason } = await searchParams;
  const message = typeof reason === "string" ? REASONS[reason] : undefined;
  if (!message) return null;
  return (
    <p className="mb-4 rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">{message}</p>
  );
}
