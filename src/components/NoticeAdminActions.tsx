"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteNotice, hideNotice, unhideNotice, type ActionResult } from "@/app/admin/notices/actions";

/** お知らせの管理ボタン（編集・非表示・再表示・完全削除）。管理者画面だけに置く */
export function NoticeAdminActions({ noticeId, hidden }: { noticeId: string; hidden: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: (id: string) => Promise<ActionResult>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action(noticeId);
      setError(result?.error ?? null);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/admin/notices/${noticeId}/edit`}
          className="flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white"
        >
          編集する
        </Link>
        {hidden ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(unhideNotice, "このお知らせを再表示します。ドライバーの画面にもう一度表示されます。よろしいですか？")}
            className="min-h-12 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary disabled:opacity-60"
          >
            再表示する
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(hideNotice, "このお知らせを非表示にします。ドライバーの画面から消えますが、データと既読記録は残ります。よろしいですか？")
            }
            className="min-h-12 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary disabled:opacity-60"
          >
            非表示にする
          </button>
        )}
      </div>
      {hidden && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(deleteNotice, "既読記録も消えます。よろしいですか？")}
          className="min-h-12 rounded-lg border-2 border-gold-line bg-white text-base font-bold text-gold disabled:opacity-60"
        >
          完全に削除する
        </button>
      )}
      {pending && <p className="text-base text-gray-600">処理中…</p>}
    </div>
  );
}
