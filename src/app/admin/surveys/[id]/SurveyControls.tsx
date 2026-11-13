"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteSurvey, setSurveyHidden, updateSurveySettings, type SurveyActionResult } from "../actions";

const initial: SurveyActionResult = { ok: false, message: null };

function Message({ state }: { state: SurveyActionResult }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-lg p-3 text-base ${state.ok ? "bg-primary/10 text-primary" : "border-2 border-gold-line text-gold"}`}>
      {state.message}
    </p>
  );
}

/** 題名・説明・締め切りの変更と、非表示・再表示・完全削除 */
export function SurveyControls({
  id,
  title,
  description,
  deadlineLocal,
  hidden,
}: {
  id: string;
  title: string;
  description: string;
  /** 入力欄用の「2026-11-10T17:00」（日本時間） */
  deadlineLocal: string;
  hidden: boolean;
}) {
  const [state, formAction, saving] = useActionState(updateSurveySettings, initial);
  const [result, setResult] = useState<SurveyActionResult>(initial);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<SurveyActionResult>, question: string) => {
    if (!window.confirm(question)) return;
    startTransition(async () => setResult((await fn()) ?? initial));
  };

  return (
    <div className="flex flex-col gap-3">
      <Message state={result} />
      <div className="grid grid-cols-2 gap-2">
        {hidden ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setSurveyHidden(id, false), "このアンケートを再表示します。よろしいですか？")}
            className="min-h-12 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary disabled:opacity-60"
          >
            再表示する
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setSurveyHidden(id, true), "このアンケートを非表示にします。ドライバーの画面から消えますが、回答は残ります。よろしいですか？")}
            className="min-h-12 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary disabled:opacity-60"
          >
            非表示にする
          </button>
        )}
        {hidden && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteSurvey(id), "回答もすべて消えます。よろしいですか？")}
            className="min-h-12 rounded-lg border-2 border-gold-line bg-white text-base font-bold text-gold disabled:opacity-60"
          >
            完全に削除する
          </button>
        )}
      </div>
      <details className="rounded-lg border border-gray-200 p-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-base text-primary">題名・説明・締め切りを変える</summary>
        <form action={formAction} className="mt-2 flex flex-col gap-3">
          <Message state={state} />
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">題名</span>
            <input name="title" required maxLength={100} defaultValue={title} className="min-h-12 rounded-lg border border-gray-300 px-3 text-base" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">説明</span>
            <textarea name="description" rows={3} maxLength={2000} defaultValue={description} className="rounded-lg border border-gray-300 p-3 text-base" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">締め切り（空なら締め切りなし）</span>
            <input name="deadline" type="datetime-local" defaultValue={deadlineLocal} className="min-h-12 rounded-lg border border-gray-300 px-3 text-base" />
          </label>
          <p className="text-sm text-gray-600">質問は、集計が崩れないよう、公開後は変えられません。</p>
          <button type="submit" disabled={saving} className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60">
            {saving ? "保存中…" : "保存する"}
          </button>
        </form>
      </details>
    </div>
  );
}
