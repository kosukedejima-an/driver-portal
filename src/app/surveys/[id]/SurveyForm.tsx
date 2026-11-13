"use client";

import { useState, useTransition } from "react";
import type { SurveyQuestion } from "@/lib/surveys";
import { answerSurvey } from "../actions";

type Answers = Record<string, { choices?: number[]; text?: string }>;

export function SurveyForm({
  surveyId,
  questions,
  initial,
  open,
  answered,
}: {
  surveyId: string;
  questions: SurveyQuestion[];
  initial: Answers;
  open: boolean;
  answered: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const disabled = !open || pending;

  const choose = (q: SurveyQuestion, k: number) =>
    setAnswers((prev) => {
      const cur = prev[q.id]?.choices ?? [];
      const next = q.kind === "single" ? [k] : cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].sort();
      return { ...prev, [q.id]: { choices: next } };
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => setResult(await answerSurvey(surveyId, answers)));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <legend className="sr-only">質問{i + 1}</legend>
          <p className="text-base font-bold leading-snug">
            <span className="text-primary">Q{i + 1}．</span>
            {q.text}
            <span className={`ml-2 text-sm font-normal ${q.required ? "text-gold" : "text-gray-500"}`}>
              {q.required ? "必須" : "任意"}
            </span>
          </p>
          {q.kind !== "text" && (
            <p className="mt-1 text-sm text-gray-600">{q.kind === "single" ? "1つ選んでください" : "あてはまるものをすべて選んでください"}</p>
          )}
          {q.kind === "text" ? (
            <textarea
              rows={4}
              maxLength={2000}
              disabled={disabled}
              value={answers[q.id]?.text ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { text: e.target.value } }))}
              className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-base disabled:bg-gray-50"
            />
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {q.options.map((opt, k) => {
                const checked = answers[q.id]?.choices?.includes(k) ?? false;
                return (
                  <label
                    key={k}
                    className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 text-base ${
                      checked ? "border-primary bg-primary/5" : "border-gray-300"
                    } ${disabled ? "opacity-70" : ""}`}
                  >
                    <input
                      type={q.kind === "single" ? "radio" : "checkbox"}
                      name={q.id}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => choose(q, k)}
                      className="size-5 accent-[#701648]"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      ))}

      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-base ${result.ok ? "bg-primary/10 font-bold text-primary" : "border-2 border-gold-line text-gold"}`}
        >
          {result.message}
        </p>
      )}
      {open ? (
        <button
          type="submit"
          disabled={pending}
          className="min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60"
        >
          {pending ? "送信中…" : answered || result?.ok ? "回答を直して送る" : "回答を送る"}
        </button>
      ) : (
        <p className="rounded-lg bg-gray-100 p-3 text-center text-base">締め切りを過ぎたため、回答できません。</p>
      )}
    </form>
  );
}
