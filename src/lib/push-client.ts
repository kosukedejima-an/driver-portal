"use client";

// スマホ側の通知の設定（ブラウザの中で動く）
import { removeSubscription, saveSubscription, type PushResult } from "@/app/push/actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushKeyAvailable(): boolean {
  return PUBLIC_KEY.length > 0;
}

/** ホーム画面に追加したアプリとして開かれているか */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  return (await registration()).pushManager.getSubscription();
}

/** 通知を許可してもらい、このスマホを送り先として登録する（ボタンを押したときに呼ぶ） */
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, message: "このスマホ・ブラウザでは通知を受け取れません。" };
  if (!pushKeyAvailable()) return { ok: false, message: "通知の準備がまだできていません。管理者に連絡してください。" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "通知が許可されませんでした。スマホの設定から、このアプリの通知を許可してください。" };
  }
  return subscribeAndSave();
}

/** すでに許可されている場合に、送り先の登録だけを行う（画面を開いたときに自動で呼ぶ） */
export async function subscribeAndSave(): Promise<PushResult> {
  try {
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
    return await saveSubscription(sub.toJSON(), navigator.userAgent);
  } catch {
    return { ok: false, message: "通知の登録に失敗しました。もう一度お試しください。" };
  }
}

/** このスマホへの通知をやめる */
export async function disablePush(): Promise<PushResult> {
  const sub = await currentSubscription();
  if (sub) {
    await removeSubscription(sub.endpoint).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return { ok: true, message: "このスマホへの通知を止めました。" };
}

/** ホーム画面のアイコンの数字（対応している機種のみ） */
export function setBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge) return;
  (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
}
