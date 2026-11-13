"use client";

import { BrandBar } from "@/components/BrandBar";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
    <BrandBar />
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-xl font-bold">エラーが発生しました</h1>
      <p className="text-base">
        通信状態を確認して、もう一度お試しください。直らない場合は管理者に連絡してください。
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-12 w-full rounded-lg bg-primary text-base font-bold text-white"
      >
        もう一度読み込む
      </button>
    </main>
    </>
  );
}
