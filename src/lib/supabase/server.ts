// サーバー側から Supabase を使うための接続口（ログイン状態は cookie で受け渡す）
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseEnv } from "./env";

export async function createClient() {
  // ログインした人ごとに内容が変わるため、必ずアクセスのたびに実行する（事前に組み立てない）
  await connection();
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 画面の表示中は cookie を書き換えられないため無視する（ログイン処理側で更新する）
        }
      },
    },
  });
}
