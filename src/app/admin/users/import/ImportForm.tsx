"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { ApplyResult, Plan, PlanRow } from "@/lib/employee-import";
import { commitImport, previewImport } from "./actions";

const SAMPLE = [
  "employee_no,name,office,company,role,active",
  "1001,架空 一郎,本社営業所,,driver,true",
  "1002,見本 花子,本社営業所,,admin,true",
].join("\r\n");

function downloadSample() {
  // Excel で文字化けしないよう、先頭に印（BOM）を付けた UTF-8 で保存する
  const blob = new Blob(["﻿" + SAMPLE + "\r\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "社員取り込みのひな形.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function RowList({ rows, title, tone }: { rows: PlanRow[]; title: string; tone: "error" | "normal" }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className={`text-base font-bold ${tone === "error" ? "text-gold" : ""}`}>
        {title}（{rows.length}）
      </h3>
      <ul className="mt-2 divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.line} className="py-2">
            <p className="text-base">
              <span className="text-sm text-gray-600">{r.line}行目　</span>
              <span className="font-bold">{r.name || "（氏名なし）"}</span>
              {r.employeeNo && <span className="text-sm text-gray-600">（社員番号 {r.employeeNo}）</span>}
            </p>
            {r.reason && <p className="text-base text-gold">{r.reason}</p>}
            {r.action === "new" && <p className="text-sm text-gray-600">{r.office}</p>}
            {r.changes.map((c) => (
              <p key={c} className="text-sm text-gray-600">
                {c}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formData = () => {
    const fd = new FormData();
    const file = fileRef.current?.files?.[0];
    if (file) fd.set("file", file);
    return fd;
  };
  const reset = () => {
    setPlan(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const preview = () =>
    startTransition(async () => {
      setResult(null);
      const r = await previewImport(formData());
      setPlan(r.plan);
      setError(r.error);
    });

  const commit = () => {
    if (!plan) return;
    if (!window.confirm(`新規${plan.counts.new}名・更新${plan.counts.update}名を取り込みます。エラーの行は取り込みません。よろしいですか？`)) {
      return;
    }
    startTransition(async () => {
      const r = await commitImport(formData());
      setError(r.error);
      if (r.result) {
        setResult(r.result);
        setPlan(null);
      }
    });
  };

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <section role="status" className="rounded-lg bg-primary/10 p-4 text-primary">
          <p className="text-lg font-bold">取り込みが終わりました</p>
          <p className="mt-1 text-base">
            新規 {result.created}名、更新 {result.updated}名
            {result.failed.length > 0 && `、うまくいかなかった行 ${result.failed.length}件`}
          </p>
        </section>
        {result.failed.length > 0 && (
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-base font-bold text-gold">うまくいかなかった行</h3>
            <ul className="mt-2 divide-y divide-gray-100">
              {result.failed.map((f) => (
                <li key={f.line} className="py-2 text-base">
                  {f.line}行目（社員番号 {f.employeeNo}）：<span className="text-gold">{f.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Link href="/admin/users" className="flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
          社員管理に戻る
        </Link>
        <button type="button" onClick={reset} className="min-h-12 rounded-lg border border-gray-300 text-base text-primary">
          別のファイルを取り込む
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-2">
          <span className="text-base font-bold">CSVファイルを選ぶ</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={() => {
              setPlan(null);
              setError(null);
            }}
            className="min-h-12 text-base"
          />
        </label>
        <button
          type="button"
          onClick={preview}
          disabled={pending}
          className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60"
        >
          {pending && !plan ? "確認中…" : "内容を確認する"}
        </button>
        <button type="button" onClick={downloadSample} className="min-h-11 text-base text-primary underline">
          ひな形（見本のCSV）をダウンロード
        </button>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
          {error}
        </p>
      )}

      {plan && (
        <>
          <section className="rounded-lg border-2 border-primary bg-white p-4">
            <h2 className="text-lg font-bold">取り込みの確認</h2>
            <p className="mt-2 text-xl font-bold">
              新規 {plan.counts.new}名、更新 {plan.counts.update}名、
              <span className={plan.counts.error > 0 ? "text-gold" : ""}>エラー {plan.counts.error}件</span>
            </p>
            {plan.counts.unchanged > 0 && (
              <p className="mt-1 text-sm text-gray-600">ほかに、今と同じ内容の行が{plan.counts.unchanged}件あります（何もしません）。</p>
            )}
            <p className="mt-2 text-sm text-gray-600">エラーの行は取り込みません。直したい場合は、CSVを直してからもう一度「内容を確認する」を押してください。</p>
            <button
              type="button"
              onClick={commit}
              disabled={pending || plan.counts.new + plan.counts.update === 0}
              className="mt-3 min-h-12 w-full rounded-lg bg-primary text-base font-bold text-white disabled:opacity-40"
            >
              {pending ? "取り込み中…" : "この内容で取り込む"}
            </button>
          </section>
          <RowList rows={plan.rows.filter((r) => r.action === "error")} title="エラーの行" tone="error" />
          <RowList rows={plan.rows.filter((r) => r.action === "new")} title="新規" tone="normal" />
          <RowList rows={plan.rows.filter((r) => r.action === "update")} title="更新" tone="normal" />
        </>
      )}
    </div>
  );
}
