"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * 分かりやすい「ファイルを選ぶ」ボタン。
 * 本物のファイル選択欄は見えないようにして（フォームの送信には使える）、代わりに大きなボタンを出す。
 * 選んだあとは、写真なら小さな見本、PDFならファイル名と「取り消す」を出す。
 */
export function FilePicker({
  name,
  accept,
  multiple = false,
  required = false,
  buttonLabel,
  kind,
  onFiles,
}: {
  /** フォームでそのまま送るときの名前（自分で受け取るときは onFiles を使う） */
  name?: string;
  accept: string;
  multiple?: boolean;
  required?: boolean;
  buttonLabel: string;
  kind: "photo" | "pdf" | "csv";
  onFiles?: (files: File[]) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // 写真の見本は、画面の中だけで使う一時的なアドレス。使い終わったら片付ける
  const current = useRef<string[]>([]);
  useEffect(() => () => current.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const choose = (list: File[]) => {
    current.current.forEach((u) => URL.revokeObjectURL(u));
    current.current = kind === "photo" ? list.map((f) => URL.createObjectURL(f)) : [];
    setPreviews(current.current);
    setFiles(list);
    onFiles?.(list);
  };
  const clear = () => {
    if (input.current) input.current.value = "";
    choose([]);
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        onChange={(e) => choose(Array.from(e.target.files ?? []))}
        className="sr-only"
      />
      <label
        htmlFor={id}
        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/5 px-4 text-base font-bold text-primary hover:bg-primary/10 focus-within:outline"
      >
        {kind === "photo" ? (
          <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="m21 16-5-5-8 8" />
          </svg>
        ) : (
          <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
          </svg>
        )}
        {files.length > 0 ? (multiple ? "選び直す" : "別のファイルにする") : buttonLabel}
      </label>
      {files.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2">
          {kind === "photo" && previews.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previews.map((url, i) => (
                <li key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 選んだ写真の見本（一時的なアドレス） */}
                  <img src={url} alt={`選んだ写真${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm break-all text-gray-700">
              {files.length === 1 ? files[0].name : `${files.length}個のファイルを選びました`}
            </span>
            <button type="button" onClick={clear} className="min-h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm text-primary">
              取り消す
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
