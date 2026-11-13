"use client";

import { useState, useTransition } from "react";
import { insertDummy, removeDummy, type DummyState } from "./actions";

export function DummyButtons() {
  const [state, setState] = useState<DummyState>({ ok: false, message: null });
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<DummyState>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => setState(await action()));
  };

  return (
    <div className="flex flex-col gap-3">
      {pending && (
        <p role="status" className="rounded-lg bg-primary/10 p-3 text-base text-primary">
          処理中です。そのまましばらくお待ちください…
        </p>
      )}
      {!pending && state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-base ${state.ok ? "bg-primary/10 text-primary" : "border-2 border-gold-line text-gold"}`}
        >
          {state.message}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            insertDummy,
            "ダミーデータを入れます。すでにダミーデータがある場合は、いったん消してから入れ直します。よろしいですか？",
          )
        }
        className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60"
      >
        ダミーデータを入れる
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(removeDummy, "ダミーの印が付いたお知らせと社員をすべて消します。本物のデータは消えません。よろしいですか？")
        }
        className="min-h-12 rounded-lg border-2 border-gold-line bg-white text-base font-bold text-gold disabled:opacity-60"
      >
        ダミーデータを消す
      </button>
    </div>
  );
}
