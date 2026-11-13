// プッシュ通知を送る（サーバー側だけで使う）
// 鍵は環境変数 NEXT_PUBLIC_VAPID_PUBLIC_KEY（公開用）と VAPID_PRIVATE_KEY（秘密）から読む。
import "server-only";
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";
import type { Category } from "./types";

type Subscription = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string };

export type PushPayload = {
  title: string;
  body: string;
  /** 通知を押したときに開く画面 */
  url: string;
  /** 同じお知らせの通知を1つにまとめるための目印 */
  tag: string;
  /** ホーム画面のアイコンに出す未読件数 */
  badge?: number;
};

export function pushKeysConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** 「【事故速報】タイトル」の形にする（タイトルがすでに【事故速報】で始まっていれば二重にしない） */
export function noticeTitle(category: Category, title: string): string {
  const prefix = `【${category}】`;
  return title.startsWith(prefix) ? title : `${prefix}${title}`;
}

/**
 * 指定した社員のスマホすべてに通知を送る。
 * makePayload には社員ごとの未読件数が渡される。届かなくなったスマホの登録は消す。
 */
export async function sendToUsers(
  userIds: string[] | "all",
  makePayload: (unread: number) => PushPayload,
  siteUrl: string,
  urgency: "normal" | "high" = "normal",
): Promise<{ sent: number; failed: number; skipped?: string }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { sent: 0, failed: 0, skipped: "no-keys" };
  const admin = createAdminClient();
  if (!admin) return { sent: 0, failed: 0, skipped: "no-service-key" };

  // 送り先：利用中の社員のスマホだけ
  let query = admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, profiles!inner(is_active)");
  query = query.eq("profiles.is_active", true);
  if (userIds !== "all") query = query.in("user_id", userIds);
  const { data, error } = await query;
  if (error) return { sent: 0, failed: 0, skipped: "no-table" };
  const subs = data as unknown as Subscription[];
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const ids = [...new Set(subs.map((s) => s.user_id))];
  const { data: counts } = await admin.rpc("unread_counts", { target_ids: ids });
  const unreadOf = new Map(((counts ?? []) as { user_id: string; unread: number }[]).map((c) => [c.user_id, Number(c.unread)]));

  // 送り主の連絡先として、アプリのURL（https）を名乗る。手元の動作確認（http）では仮の宛先にする
  const subject = siteUrl.startsWith("https://") ? siteUrl : "mailto:noreply@example.invalid";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(makePayload(unreadOf.get(s.user_id) ?? 0)),
        { TTL: 60 * 60 * 24, urgency },
      ),
    ),
  );

  const gone: number[] = [];
  const ok: number[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push(subs[i].id);
    else {
      const status = (r.reason as { statusCode?: number })?.statusCode;
      // 404・410 は「このスマホにはもう届かない」（アプリ削除・通知オフなど）
      if (status === 404 || status === 410) gone.push(subs[i].id);
    }
  });
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  if (ok.length) {
    await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("id", ok);
  }
  return { sent: ok.length, failed: results.length - ok.length };
}

/** 新しく公開したお知らせを、利用中の社員全員に通知する（同じお知らせは1回だけ） */
export async function notifyNewNotice(noticeId: string, siteUrl: string) {
  const admin = createAdminClient();
  if (!admin || !pushKeysConfigured()) return;
  // 通知済みの印を先に付ける（二重送信の防止）。印が付けられなければ送らない
  const { data: claimed } = await admin
    .from("notices")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", noticeId)
    .is("push_sent_at", null)
    .is("hidden_at", null)
    .lte("published_at", new Date().toISOString())
    .select("id, category, title");
  const notice = claimed?.[0] as { id: string; category: Category; title: string } | undefined;
  if (!notice) return;

  await sendToUsers(
    "all",
    (unread) => ({
      title: noticeTitle(notice.category, notice.title),
      body: "タップして内容を確認してください",
      url: `/notices/${notice.id}`,
      tag: `notice-${notice.id}`,
      badge: unread,
    }),
    siteUrl,
    notice.category === "事故速報" ? "high" : "normal",
  );
}

/** 新しく公開したアンケートを、利用中の社員全員に通知する（同じアンケートは1回だけ） */
export async function notifyNewSurvey(surveyId: string, siteUrl: string) {
  const admin = createAdminClient();
  if (!admin || !pushKeysConfigured()) return;
  const { data: claimed } = await admin
    .from("surveys")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", surveyId)
    .is("push_sent_at", null)
    .is("hidden_at", null)
    .select("id, title");
  const survey = claimed?.[0] as { id: string; title: string } | undefined;
  if (!survey) return;
  await sendToUsers(
    "all",
    (unread) => ({
      title: `【アンケート】${survey.title}`,
      body: "タップして回答してください",
      url: `/surveys/${survey.id}`,
      tag: `survey-${survey.id}`,
      badge: unread,
    }),
    siteUrl,
  );
}

/** 情報集の資料が新しく登録・更新されたことを、利用中の社員全員に通知する */
export async function notifyLibraryItem(itemId: string, kind: "new" | "update", siteUrl: string) {
  const admin = createAdminClient();
  if (!admin || !pushKeysConfigured()) return;
  const { data } = await admin
    .from("library_items")
    .select("id, title, hidden_at, library_genres(name)")
    .eq("id", itemId)
    .maybeSingle();
  const item = data as { id: string; title: string; hidden_at: string | null; library_genres: { name: string } | null } | null;
  if (!item || item.hidden_at) return;
  await sendToUsers(
    "all",
    (unread) => ({
      title: `【情報集・${item.library_genres?.name ?? "資料"}】${item.title}`,
      body: kind === "new" ? "新しい資料が追加されました" : "内容が更新されました",
      url: `/library/${item.id}`,
      tag: `library-${item.id}`,
      badge: unread,
    }),
    siteUrl,
  );
}

/** 配車表を載せた・差し替えたことを、利用中の社員全員に通知する */
export async function notifyDispatch(title: string, kind: "new" | "update", siteUrl: string) {
  if (!pushKeysConfigured()) return;
  await sendToUsers(
    "all",
    (unread) => ({
      title: `【配車】${title}の配車表`,
      body: kind === "new" ? "配車表が届きました。タップして確認してください" : "配車表が差し替えられました。タップして確認してください",
      url: "/dispatch",
      tag: `dispatch-${title}`,
      badge: unread,
    }),
    siteUrl,
  );
}
