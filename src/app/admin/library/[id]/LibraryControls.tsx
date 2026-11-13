"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteLibraryItem, setLibraryHidden, type LibraryResult } from "../actions";

/** 資料の管理ボタン（直す・非表示・再表示・完全削除） */
export function LibraryControls({ id, hidden }: { id: string; hidden: boolean }) {
  const [result, setResult] = useState<LibraryResult>({ ok: false, message: null });
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<LibraryResult>, question: string) => {
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
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/admin/library/${id}/edit`} className="flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
          直す・更新する
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            hidden
              ? run(() => setLibraryHidden(id, false), "この資料を再表示します。よろしいですか？")
              : run(() => setLibraryHidden(id, true), "この資料を非表示にします。ドライバーの画面から消えます。よろしいですか？")
          }
          className="min-h-12 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary disabled:opacity-60"
        >
          {hidden ? "再表示する" : "非表示にする"}
        </button>
      </div>
      {hidden && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteLibraryItem(id), "写真・PDF・閲覧の記録もすべて消えます。よろしいですか？")}
          className="min-h-12 rounded-lg border-2 border-gold-line bg-white text-base font-bold text-gold disabled:opacity-60"
        >
          完全に削除する
        </button>
      )}
    </div>
  );
}
