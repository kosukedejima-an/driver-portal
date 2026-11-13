// Supabase の接続情報は Vercel の Environment Variables（手元では .env.local）から読み込みます。
// 値をプログラムに直接書かないでください。変数名は CLAUDE.md で決めたものだけを使います。

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase の接続情報がありません。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。",
    );
  }
  return { url, anonKey };
}
