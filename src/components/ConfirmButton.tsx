"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { confirmNotice } from "@/app/actions";

export function ConfirmButton({
  noticeId,
  confirmed,
  backHref,
}: {
  noticeId: string;
  confirmed: boolean;
  /** 確認後に戻る一覧 */
  backHref: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () =>
    startTransition(async () => {
      const result = await confirmNotice(noticeId);
      setError(result.error);
    });

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-2xl">
        {confirmed ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-base font-bold text-primary">✓ 確認済みです</p>
            <Link
              href={backHref}
              className="flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-primary text-base font-bold text-primary"
            >
              一覧に戻る
            </Link>
          </div>
        ) : (
          <>
            {error && <p role="alert" className="mb-2 text-base text-gold">{error}</p>}
            <button
              type="button"
              onClick={onClick}
              disabled={pending}
              className="min-h-16 w-full rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60"
            >
              {pending ? "送信中…" : "内容を確認しました"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
