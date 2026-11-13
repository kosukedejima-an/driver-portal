// 管理者の操作（アカウント作成・パスワード再設定）専用の接続口。サーバー側だけで使う。
// SUPABASE_SERVICE_ROLE_KEY は強い権限を持つため、NEXT_PUBLIC_ を付けず、画面側に渡さない。
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const { url } = getSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
