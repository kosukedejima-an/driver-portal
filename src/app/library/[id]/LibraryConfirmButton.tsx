"use client";

import { useState, useTransition } from "react";
import { confirmLibraryItem } from "../actions";

/** 確認ボタンのある資料：画面の下に「内容を確認しました」を出す。押すと確認の記録が残る */
export function LibraryConfirmButton({ itemId, confirmed }: { itemId: string; confirmed: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (confirmed) {
    return <p className="mt-6 text-center text-base font-bold text-primary">✓ 確認済みです</p>;
  }
  return (
    <>
      {/* 下に固定したボタンで本文が隠れないように、その分の余白を空ける */}
      <div className="h-28" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          {error && <p role="alert" className="mb-2 text-base text-gold">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await confirmLibraryItem(itemId);
                setError(result.error);
              })
            }
            className="min-h-16 w-full rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60"
          >
            {pending ? "送信中…" : "内容を確認しました"}
          </button>
        </div>
      </div>
    </>
  );
}
