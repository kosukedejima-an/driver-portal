"use client";

import { useState, useTransition } from "react";
import { deleteDispatchSheet } from "./actions";

export function DeleteDispatchButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`${label}の配車表を削除します。ドライバーの画面からも消えます。よろしいですか？`)) return;
          startTransition(async () => {
            const r = await deleteDispatchSheet(id);
            setError(r.ok ? null : r.message);
          });
        }}
        className="min-h-11 rounded-lg border-2 border-gold-line px-3 text-base font-bold text-gold disabled:opacity-60"
      >
        削除
      </button>
      {error && <p role="alert" className="text-base text-gold">{error}</p>}
    </>
  );
}
