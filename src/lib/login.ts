// ログインの記録と、失敗が続いたときの一時停止（サーバー側だけで使う）
import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** この回数だけ失敗したら、しばらくその端末からは入れなくする */
const MAX_FAILURES = 10;
const WINDOW_MINUTES = 15;

export const LOCKED_MESSAGE = `間違いが続いたため、しばらく入れません。${WINDOW_MINUTES}分ほど待ってからもう一度お試しください。`;

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function isLockedOut(admin: SupabaseClient, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("created_at", since);
  if (error) return false; // 07 実行前など、記録の仕組みが無いときは止めない
  return (count ?? 0) >= MAX_FAILURES;
}

export async function recordAttempt(
  admin: SupabaseClient,
  attempt: { ip: string; loginId: string; method: "number" | "password"; success: boolean; userId?: string },
) {
  await admin.from("login_attempts").insert({
    ip: attempt.ip,
    login_id: attempt.loginId.slice(0, 100),
    method: attempt.method,
    success: attempt.success,
    user_id: attempt.userId ?? null,
  });
}
