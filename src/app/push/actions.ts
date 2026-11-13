"use server";

// プッシュ通知の登録・解除・テスト送信（ログイン中の本人の操作）
import { requireProfile } from "@/lib/auth";
import { pushKeysConfigured, sendToUsers } from "@/lib/push";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushResult = { ok: boolean; message: string | null };

type SubscriptionJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** このスマホを通知の送り先として登録する */
export async function saveSubscription(sub: SubscriptionJSON, userAgent: string): Promise<PushResult> {
  const { profile } = await requireProfile();
  const endpoint = sub.endpoint ?? "";
  if (!/^https:\/\//.test(endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, message: "通知の登録に失敗しました。" };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "現在、通知を設定できません。管理者に連絡してください。" };
  // 同じスマホを別の人が使っていた場合は、今ログインしている人の登録に置き換える
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: profile.id,
      endpoint: endpoint.slice(0, 1000),
      p256dh: sub.keys.p256dh.slice(0, 200),
      auth: sub.keys.auth.slice(0, 200),
      user_agent: userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, message: "通知の登録に失敗しました。もう一度お試しください。" };
  return { ok: true, message: "このスマホで通知を受け取るように設定しました。" };
}

/** このスマホへの通知をやめる */
export async function removeSubscription(endpoint: string): Promise<PushResult> {
  const { supabase } = await requireProfile();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true, message: "このスマホへの通知を止めました。" };
}

/** 自分のスマホにテスト通知を送る */
export async function sendTestNotification(): Promise<PushResult> {
  const { profile } = await requireProfile();
  if (!pushKeysConfigured()) {
    return { ok: false, message: "通知用の鍵がまだ設定されていません。管理者に連絡してください。" };
  }
  const result = await sendToUsers(
    [profile.id],
    (unread) => ({
      title: "【テスト】通知のテストです",
      body: "この通知が見えていれば、設定は完了です。",
      url: "/",
      tag: "test",
      badge: unread,
    }),
    await getSiteUrl(),
  );
  if (result.sent > 0) return { ok: true, message: "テスト通知を送りました。数秒〜1分ほどで届きます。" };
  if (result.skipped === "no-table") {
    return { ok: false, message: "データベースの設定（supabase/setup.sql）がまだのようです。管理者に連絡してください。" };
  }
  return {
    ok: false,
    message: "送れるスマホが見つかりませんでした。一度「通知を受け取る」をオフにしてから、もう一度オンにしてください。",
  };
}
