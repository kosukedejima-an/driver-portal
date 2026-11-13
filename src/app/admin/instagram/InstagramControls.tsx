"use client";

import { useState, useTransition } from "react";
import { deleteInstagramPost, setInstagramHidden, type InstagramResult } from "./actions";

/** 投稿の管理ボタン（非表示・再表示・完全削除） */
export function InstagramControls({ id, hidden }: { id: string; hidden: boolean }) {
  const [result, setResult] = useState<InstagramResult>({ ok: false, message: null });
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<InstagramResult>, question: string) => {
    if (!window.confirm(question)) return;
    startTransition(async () => setResult((await fn()) ?? { ok: false, message: null }));
  };
  return (
    <div className="flex flex-col gap-2">
      {result.message && (
        <p role={result.ok ? "status" : "alert"} className={`rounded-lg p-3 text-base ${result.ok ? "bg-primary/10 text-primary" : "border-2 border-gold-line text-gold"}`}>
          {result.message}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          hidden
            ? run(() => setInstagramHidden(id, false), "この投稿をタイムラインに再表示します。よろしいですか？")
            : run(() => setInstagramHidden(id, true), "この投稿を非表示にします。タイムラインから消えます。よろしいですか？")
        }
        className="min-h-12 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary disabled:opacity-60"
      >
        {hidden ? "再表示する" : "非表示にする"}
      </button>
      {hidden && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteInstagramPost(id), "いいねの記録も消えます。よろしいですか？")}
          className="min-h-12 rounded-lg border-2 border-gold-line bg-white text-base font-bold text-gold disabled:opacity-60"
        >
          完全に削除する
        </button>
      )}
    </div>
  );
}
