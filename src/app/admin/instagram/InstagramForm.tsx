"use client";

import { useActionState } from "react";
import { addInstagramPost, type InstagramResult } from "./actions";

/** Instagram の投稿のアドレスを貼って載せる */
export function InstagramForm() {
  const [result, action, pending] = useActionState<InstagramResult, FormData>(addInstagramPost, { ok: false, message: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      {result.message && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-base ${result.ok ? "bg-primary/10 font-bold text-primary" : "border-2 border-gold-line text-gold"}`}
        >
          {result.message}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">投稿のアドレス（必須）</span>
        <span className="text-sm text-gray-600">Instagramの投稿の「…」→「リンクをコピー」で取ったアドレスを貼ってください。</span>
        <input
          name="url"
          type="url"
          required
          inputMode="url"
          placeholder="https://www.instagram.com/p/…"
          className="min-h-12 rounded-lg border border-gray-300 px-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">ひとこと（なくてもよい）</span>
        <span className="text-sm text-gray-600">タイムラインで、投稿の上に表示します。</span>
        <textarea name="note" rows={2} maxLength={500} className="rounded-lg border border-gray-300 p-3 text-base" />
      </label>
      <p className="text-sm text-gray-600">通知は送りません。タイムラインに流れるだけです。公開アカウントの投稿だけ表示できます。</p>
      <button type="submit" disabled={pending} className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60">
        {pending ? "載せています…" : "タイムラインに載せる"}
      </button>
    </form>
  );
}
