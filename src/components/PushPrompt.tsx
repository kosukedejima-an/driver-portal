"use client";

import { useEffect, useState } from "react";
import {
  enablePush,
  isStandalone,
  pushKeyAvailable,
  pushSupported,
  setBadge,
  subscribeAndSave,
} from "@/lib/push-client";

const DISMISS_KEY = "push-prompt-dismissed";

/**
 * ホーム画面に追加したアプリで、最初に「お知らせが届いたら通知しますか？」と聞く。
 * あわせて、ホーム画面のアイコンの数字（未読件数）を更新する。
 */
export function PushPrompt({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setBadge(unread);
  }, [unread]);

  useEffect(() => {
    if (!pushSupported() || !pushKeyAvailable() || !isStandalone()) return;
    if (Notification.permission === "granted") {
      // すでに許可済み：送り先の登録が消えていたら、黙って登録し直す
      void subscribeAndSave();
      return;
    }
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    // 画面の表示が終わってから聞く
    if (Notification.permission === "default" && !dismissed) {
      const timer = setTimeout(() => setOpen(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!open) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setOpen(false);
  };
  const accept = async () => {
    setPending(true);
    const result = await enablePush();
    setPending(false);
    if (result.ok) close();
    else setMessage(result.message);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="push-prompt-title" className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl bg-white p-5">
        <h2 id="push-prompt-title" className="text-lg font-bold text-primary">
          お知らせが届いたら通知しますか？
        </h2>
        <p className="mt-2 text-base leading-relaxed">
          事故速報などの新しいお知らせを、スマホの通知でお知らせします。あとからマイページで変更できます。
        </p>
        {message && <p role="alert" className="mt-3 text-base text-gold">{message}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={accept}
            disabled={pending}
            className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60"
          >
            {pending ? "設定中…" : "通知を受け取る"}
          </button>
          <button type="button" onClick={close} className="min-h-12 rounded-lg border border-gray-300 text-base text-primary">
            今はしない
          </button>
        </div>
      </div>
    </div>
  );
}
