"use client";

import { useState, useTransition } from "react";
import { createSurvey, type NewQuestion } from "../actions";

const inputClass = "min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base";
const KIND_LABELS = { single: "1つ選ぶ", multi: "いくつでも選ぶ", text: "自由に書く" } as const;

type Draft = NewQuestion & { key: number; optionsText: string };
let nextKey = 1;
const blank = (): Draft => ({ key: nextKey++, kind: "single", text: "", options: [], optionsText: "", required: true });

/** アンケートを作る画面（質問を足したり、順番を入れ替えたりできる） */
export function SurveyBuilder() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [questions, setQuestions] = useState<Draft[]>([blank()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: number, patch: Partial<Draft>) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const next = [...qs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("このアンケートを公開します。公開すると社員のスマホに通知が届き、質問はあとから変えられません。よろしいですか？")) return;
    startTransition(async () => {
      const result = await createSurvey({
        title,
        description,
        deadline,
        anonymous,
        questions: questions.map((q) => ({
          kind: q.kind,
          text: q.text,
          required: q.required,
          options: q.optionsText.split("\n").map((o) => o.trim()).filter(Boolean),
        })),
      });
      if (result && !result.ok) setError(result.message);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
          {error}
        </p>
      )}
      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">題名</span>
          <input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">説明（任意）</span>
          <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg border border-gray-300 p-3 text-base" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">締め切り（任意）</span>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          <span className="text-sm text-gray-600">空のままなら締め切りなし。あとから変えられます。</span>
        </label>
        <label className="flex min-h-11 items-start gap-3 text-base">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 size-5 accent-[#701648]" />
          <span>
            <span className="font-bold">無記名にする</span>
            <span className="block text-sm text-gray-600">だれが何と答えたかを、管理者にも見せません（集計と、回答したかどうかだけ分かります）。</span>
          </span>
        </label>
      </section>

      {questions.map((q, i) => (
        <section key={q.key} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-primary">質問{i + 1}</h3>
            <div className="flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="上へ" className="size-11 rounded-lg border border-gray-300 text-base disabled:opacity-30">
                ↑
              </button>
              <button type="button" disabled={i === questions.length - 1} onClick={() => move(i, 1)} aria-label="下へ" className="size-11 rounded-lg border border-gray-300 text-base disabled:opacity-30">
                ↓
              </button>
              <button
                type="button"
                disabled={questions.length === 1}
                onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-30"
              >
                削除
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">質問の文</span>
            <input required maxLength={300} value={q.text} onChange={(e) => update(q.key, { text: e.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">答え方</span>
            <select value={q.kind} onChange={(e) => update(q.key, { kind: e.target.value as Draft["kind"] })} className={inputClass}>
              {(Object.keys(KIND_LABELS) as Draft["kind"][]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          {q.kind !== "text" && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold">選択肢（1行に1つ）</span>
              <textarea
                rows={4}
                value={q.optionsText}
                onChange={(e) => update(q.key, { optionsText: e.target.value })}
                placeholder={"例：\nはい\nいいえ"}
                className="rounded-lg border border-gray-300 p-3 text-base"
              />
            </label>
          )}
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input type="checkbox" checked={q.required} onChange={(e) => update(q.key, { required: e.target.checked })} className="size-5 accent-[#701648]" />
            答えを必須にする
          </label>
        </section>
      ))}

      <button
        type="button"
        onClick={() => setQuestions((qs) => [...qs, blank()])}
        className="min-h-12 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary"
      >
        ＋ 質問を足す
      </button>
      <button type="submit" disabled={pending} className="min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60">
        {pending ? "公開中…" : "公開する"}
      </button>
    </form>
  );
}
