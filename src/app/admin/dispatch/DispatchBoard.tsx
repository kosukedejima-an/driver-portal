"use client";

import { useState, useTransition } from "react";
import { DispatchGrid } from "@/components/DispatchGrid";
import { FilePicker } from "@/components/FilePicker";
import type { DispatchCell } from "@/lib/dispatch";
import { formatSheetDate } from "@/lib/dispatch-date";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { DeleteDispatchButton } from "./DeleteDispatchButton";
import { prepareDispatchUpload, saveDispatchSheet, type DispatchResult } from "./actions";

/**
 * 管理者の配車表：カレンダーの日付のマスを押して選び、PDFを載せる・差し替える・消す。
 * 1週間より先の日付は、下の「1週間より先の日付を選ぶ」から選べる。
 */
export function DispatchBoard({ dates, cells }: { dates: string[]; cells: DispatchCell[] }) {
  // はじめは明日を選んでおく（前の日に載せることが多いため）
  const [selected, setSelected] = useState<string>(dates[1] ?? dates[0]);
  const [file, setFile] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [result, setResult] = useState<DispatchResult>({ ok: false, message: null });
  const [pending, startTransition] = useTransition();

  const cell = cells.find((c) => c.date === selected);
  const inWeek = dates.includes(selected);
  const select = (date: string) => {
    setSelected(date);
    setResult({ ok: false, message: null });
  };

  const upload = () => {
    if (!file) return setResult({ ok: false, message: "PDFを選んでください。" });
    startTransition(async () => {
      setResult({ ok: false, message: null });
      const prepared = await prepareDispatchUpload({ type: file.type, size: file.size });
      if ("error" in prepared) return setResult({ ok: false, message: prepared.error });
      const { error } = await createClient()
        .storage.from("dispatch-files")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: "application/pdf" });
      if (error) return setResult({ ok: false, message: "PDFを送れませんでした。通信状態を確認して、もう一度お試しください。" });
      const saved = await saveDispatchSheet({ date: selected, path: prepared.path, name: file.name });
      setResult(saved);
      if (saved.ok) {
        setFile(null);
        setPickerKey((k) => k + 1); // ファイルの選択を空に戻す
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <section className="rounded-lg border border-gray-200 bg-white p-2">
        <DispatchGrid dates={dates} cells={cells} onSelect={select} selected={selected} />
        <p className="mt-2 px-2 pb-1 text-sm text-gray-600">日付のマスを押して選んでから、右（スマホでは下）でPDFを載せます。色の付いたマスは載せ済みです。</p>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border-2 border-primary bg-white p-4">
        <h2 className="text-lg font-bold">{formatSheetDate(selected)}の配車表</h2>
        {result.message && (
          <p role={result.ok ? "status" : "alert"} className={`rounded-lg p-3 text-base ${result.ok ? "bg-primary/10 font-bold text-primary" : "border-2 border-gold-line text-gold"}`}>
            {result.message}
          </p>
        )}

        {cell?.sheet ? (
          <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
            <p className="text-base font-bold text-primary">載せ済みです</p>
            <p className="text-sm break-all text-gray-600">{cell.sheet.pdfName}</p>
            <p className="text-sm text-gray-600">
              {formatDateTime(cell.sheet.postedAt)} に{cell.sheet.replaced ? "差し替え" : "掲載"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {cell.url && (
                <a href={cell.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-base font-bold text-white">
                  開く
                </a>
              )}
              <DeleteDispatchButton id={cell.sheet.id} label={formatSheetDate(selected)} />
            </div>
          </div>
        ) : (
          <p className="text-base text-gray-600">{inWeek ? "まだ載っていません。" : "1週間より先の日付です（すでに載っていれば差し替えになります）。"}</p>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">{cell?.sheet ? "差し替えるPDF" : "載せるPDF"}（20MBまで）</span>
          <FilePicker key={pickerKey} accept="application/pdf" kind="pdf" buttonLabel="配車表のPDFを選ぶ" onFiles={(files) => setFile(files[0] ?? null)} />
        </div>
        <button type="button" onClick={upload} disabled={pending || !file} className="min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-50">
          {pending ? "送っています…" : cell?.sheet ? "差し替える" : "この日付で載せる"}
        </button>
        <p className="-mt-2 text-sm text-gray-600">載せる・差し替えると、社員のスマホに通知します。</p>

        <details className="rounded-lg border border-gray-200 p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-base text-primary">1週間より先の日付を選ぶ</summary>
          <div className="mt-2">
            <input
              type="date"
              value={selected}
              min={dates[0]}
              onChange={(e) => e.target.value && select(e.target.value)}
              aria-label="日付"
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-base"
            />
          </div>
        </details>
      </section>
    </div>
  );
}
