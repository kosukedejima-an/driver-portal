"use client";

import { siteConfig } from "@/config/site";
import { useEffect, useState, useTransition } from "react";
import { sendTestNotification } from "@/app/push/actions";
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIOS,
  isStandalone,
  pushKeyAvailable,
  pushSupported,
} from "@/lib/push-client";

type Status = "checking" | "unsupported" | "ios-browser" | "no-key" | "denied" | "on" | "off";

/** マイページの通知設定：このスマホでの通知のオン・オフと、テスト通知 */
export function PushSettings() {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return setStatus(isIOS() && !isStandalone() ? "ios-browser" : "unsupported");
      if (!pushKeyAvailable()) return setStatus("no-key");
      if (Notification.permission === "denied") return setStatus("denied");
      setStatus((await currentSubscription()) && Notification.permission === "granted" ? "on" : "off");
    })();
  }, []);

  const toggle = () =>
    startTransition(async () => {
      const result = status === "on" ? await disablePush() : await enablePush();
      setMessage(result.message ? { ok: result.ok, text: result.message } : null);
      if (status === "on") setStatus("off");
      else if (result.ok) setStatus("on");
      else if (Notification.permission === "denied") setStatus("denied");
    });

  const test = () =>
    startTransition(async () => {
      const result = await sendTestNotification();
      setMessage(result.message ? { ok: result.ok, text: result.message } : null);
    });

  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-base font-bold">通知</h2>

      {status === "checking" && <p className="mt-2 text-base text-gray-600">確認中…</p>}
      {status === "unsupported" && (
        <p className="mt-2 text-base">このスマホ・ブラウザでは通知を受け取れません。</p>
      )}
      {status === "ios-browser" && (
        <p className="mt-2 text-base leading-relaxed">
          iPhoneでは、ホーム画面に追加したアプリから開くと通知を設定できます。Safariの共有ボタン（四角から矢印が出ているマーク）→「ホーム画面に追加」で追加してください。
        </p>
      )}
      {status === "no-key" && (
        <p className="mt-2 text-base">通知の準備がまだできていません。管理者に連絡してください。</p>
      )}
      {status === "denied" && (
        <p className="mt-2 text-base leading-relaxed">
          このスマホでは通知が「許可しない」になっています。スマホの「設定」アプリで、このアプリ（{siteConfig.appShortName}）の通知を許可してから、もう一度開いてください。
        </p>
      )}

      {(status === "on" || status === "off") && (
        <>
          <div className="mt-2 flex min-h-12 items-center justify-between gap-3">
            <span className="text-base">新しいお知らせを通知する</span>
            <button
              type="button"
              role="switch"
              aria-checked={status === "on"}
              aria-label="新しいお知らせを通知する"
              onClick={toggle}
              disabled={pending}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                status === "on" ? "bg-primary" : "bg-gray-300"
              } before:absolute before:-inset-2 before:content-['']`}
            >
              <span
                className={`absolute top-1 left-1 size-6 rounded-full bg-white transition-transform ${
                  status === "on" ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-gray-600">{status === "on" ? "オン（このスマホに届きます）" : "オフ"}</p>
          <button
            type="button"
            onClick={test}
            disabled={pending || status !== "on"}
            className="mt-3 min-h-12 w-full rounded-lg border-2 border-primary bg-white text-base font-bold text-primary disabled:opacity-40"
          >
            テスト通知を送る
          </button>
        </>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-3 text-base ${message.ok ? "text-primary" : "text-gold"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
