"use client";

import { useState } from "react";
import { disablePush, pushSupported, setBadge } from "@/lib/push-client";

/** ログアウト：このスマホへの通知も止めてから、ログアウトする（別の人が同じスマホを使っても届かないように） */
export function LogoutButton() {
  const [pending, setPending] = useState(false);
  return (
    <form
      action="/auth/signout"
      method="post"
      className="mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setPending(true);
        if (pushSupported()) {
          // 通知の解除が終わらなくても、3秒でログアウトに進む
          await Promise.race([disablePush().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
          setBadge(0);
        }
        form.submit();
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg border border-gray-300 bg-white text-base text-primary disabled:opacity-60"
      >
        {pending ? "ログアウト中…" : "ログアウト"}
      </button>
    </form>
  );
}
