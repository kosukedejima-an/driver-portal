import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/**
 * ログイン中の社員と、管理者として使えるかを調べる。
 * 1回の画面表示の中では何度呼んでも、実際の確認は1回だけ（cache）。
 * ログインの確認は getClaims()：ログインの証明書の署名をその場で確かめる（多くの場合、通信しない）。
 * 利用停止・管理者かどうかは、毎回データベースで確かめる。
 */
const loadSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { supabase, profile: null, isAdmin: false };
  // 社員情報と「管理者か」は、同時に問い合わせる
  const [profileRes, adminRes] = await Promise.all([
    // "*" にしておくと、利用停止の列（is_active）がまだ無くてもエラーにならない
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>(),
    supabase.rpc("is_admin"),
  ]);
  return { supabase, profile: profileRes.data, isAdmin: adminRes.data === true };
});

/** ログイン中の社員情報を取得する。未ログインならログイン画面へ移動する */
export async function requireProfile() {
  const { supabase, profile } = await loadSession();
  if (!profile) {
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) redirect("/login");
    // ログインはできても社員として登録されていない場合は、ログアウトさせる
    redirect("/auth/signout?reason=no-profile");
  }
  // 利用停止にされた社員は、スマホがログイン状態を覚えていてもログアウトさせる
  if (profile.is_active === false) redirect("/auth/signout?reason=suspended");
  return { supabase, profile };
}

/**
 * 管理者だけが使える画面・操作で呼ぶ。
 * 管理者の社員でも、社員番号だけで入った場合は使えない（判定はデータベースの is_admin()）。
 */
export async function requireAdmin() {
  const result = await requireProfile();
  const { isAdmin } = await loadSession();
  if (result.profile.role !== "admin" || !isAdmin) redirect("/");
  return result;
}

/** 管理者として使えるか（画面の出し分け用。マイページなど） */
export async function canUseAdmin(): Promise<boolean> {
  return (await loadSession()).isAdmin;
}
