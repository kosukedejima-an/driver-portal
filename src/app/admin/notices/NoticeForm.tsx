"use client";

import { useRef, useState, useTransition } from "react";
import { CATEGORIES, type Category, type Notice } from "@/lib/types";
import { FilePicker } from "@/components/FilePicker";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { createNotice, updateNotice } from "./actions";
import { readAccidentFile } from "./read-actions";

const inputClass = "min-h-12 rounded-lg border border-gray-300 bg-white px-3 text-base";
const textareaClass = "rounded-lg border border-gray-300 bg-white p-3 text-base leading-relaxed";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-base font-bold">{label}</span>
      {children}
      {hint && <span className="text-sm text-gray-600">{hint}</span>}
    </label>
  );
}

/**
 * お知らせの投稿・編集フォーム。
 * notice を渡すと編集（今の内容が入った状態）、渡さなければ新規投稿。
 */
export function NoticeForm({
  notice,
  photoUrl,
  defaultAuthor = "本社",
  canReadReport = false,
}: {
  notice?: Notice;
  photoUrl?: string | null;
  defaultAuthor?: string;
  /** AIの鍵が登録されているときだけ true（「事故報告書から読み取る」を出す） */
  canReadReport?: boolean;
}) {
  const isEdit = notice !== undefined;
  const [category, setCategory] = useState<Category>(notice?.category ?? "安全・運行");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isAccident = category === "事故速報";
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const photo = formData.get("photo");
      if (photo instanceof File && photo.size > 0) formData.set("photo", await shrinkPhoto(photo));
      const result = isEdit ? await updateNotice(formData) : await createNotice(formData);
      setError(result?.error ?? null);
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
          {error}
        </p>
      )}
      {isEdit && <input type="hidden" name="id" value={notice.id} />}

      <Field label="カテゴリ">
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="タイトル">
        <input name="title" required maxLength={100} defaultValue={notice?.title} className={inputClass} />
      </Field>

      <Field label="投稿者" hint="例：本社 安全推進課">
        <input
          name="authorLabel"
          required
          maxLength={50}
          defaultValue={notice?.author_label ?? defaultAuthor}
          className={inputClass}
        />
      </Field>

      {isAccident && canReadReport && <ReportReader formRef={formRef} />}

      {isAccident && (
        <fieldset className="flex flex-col gap-4 rounded-lg border-2 border-gold-line p-3">
          <legend className="px-1 text-base font-bold text-gold">事故速報の3項目（すべて必須）</legend>
          <Field label="発生状況" hint="いつ・どこで・何が起きたか">
            <textarea
              name="situation"
              required
              rows={4}
              maxLength={3000}
              defaultValue={notice?.accident_situation ?? ""}
              className={textareaClass}
            />
          </Field>
          <Field label="原因">
            <textarea
              name="cause"
              required
              rows={3}
              maxLength={3000}
              defaultValue={notice?.accident_cause ?? ""}
              className={textareaClass}
            />
          </Field>
          <Field label="再発防止" hint="ドライバーに守ってほしいこと">
            <textarea
              name="prevention"
              required
              rows={3}
              maxLength={3000}
              defaultValue={notice?.accident_prevention ?? ""}
              className={textareaClass}
            />
          </Field>
        </fieldset>
      )}

      <Field label={isAccident ? "補足（任意）" : "本文"}>
        <textarea
          name="body"
          required={!isAccident}
          rows={6}
          maxLength={5000}
          defaultValue={notice?.body ?? ""}
          className={textareaClass}
        />
      </Field>

      {isEdit && photoUrl && (
        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">今の写真</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- 期限付きURLの写真のため通常の img を使う */}
          <img src={photoUrl} alt="今の写真" className="max-h-48 w-fit rounded-lg" />
          <label className="flex min-h-11 items-center gap-2 text-base">
            <input type="checkbox" name="removePhoto" className="size-5" />
            写真を外す
          </label>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-base font-bold">{isEdit && photoUrl ? "写真を差し替える（任意）" : "写真（任意）"}</span>
        <FilePicker name="photo" accept="image/jpeg,image/png,image/webp" kind="photo" buttonLabel="写真を選ぶ" />
        <span className="text-sm text-gray-600">スマホなら、その場で撮影もできます。大きな写真は自動で小さくしてから送ります。</span>
      </div>
      <Field label="写真の説明（任意）">
        <input name="photoCaption" maxLength={100} defaultValue={notice?.photo_caption ?? ""} className={inputClass} />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60"
      >
        {pending ? "保存中…" : isEdit ? "変更を保存する" : "投稿する"}
      </button>
    </form>
  );
}

/**
 * 事故報告書（決まった書式）の画像・PDFを AI で読み取り、タイトルと事故速報の3項目に下書きを入れる。
 * 投稿はしない。管理者が中身を確かめて直してから「投稿する」を押す
 */
function ReportReader({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string; notes?: string } | null>(null);

  const read = () => {
    if (!file) return;
    const form = formRef.current;
    if (!form) return;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    const names = ["title", "situation", "cause", "prevention"];
    if (names.some((n) => field(n)?.value.trim()) && !window.confirm("入力済みの内容を、読み取った内容で書き換えます。よろしいですか？")) return;
    startTransition(async () => {
      setMessage(null);
      const send = file.type.startsWith("image/") ? await shrinkPhoto(file, 2400) : file;
      const data = new FormData();
      data.set("file", send);
      const result = await readAccidentFile(data);
      if (!result.ok) return setMessage({ ok: false, text: result.message });
      const { title, situation, cause, prevention, notes } = result.draft;
      const values: Record<string, string> = { title, situation, cause, prevention };
      for (const n of names) {
        const el = field(n);
        if (el) el.value = values[n];
      }
      const empty = names.filter((n) => n !== "title" && !values[n].trim()).length;
      setMessage({
        ok: true,
        text: `読み取った内容を下に入れました。${empty > 0 ? `空の項目が${empty}つあります。` : ""}必ず中身を確かめて、直してから投稿してください。`,
        notes: notes.trim() || undefined,
      });
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-primary bg-primary/5 p-3">
      <div>
        <h3 className="text-base font-bold text-primary">事故報告書から読み取る（任意）</h3>
        <p className="mt-1 text-sm text-gray-600">
          事故報告書の写真・画像・PDFを選ぶと、AIが読み取ってタイトルと3項目に下書きを入れます。氏名や車両番号は「運転者」「当該車両」などに置き換えます。
        </p>
      </div>
      <FilePicker accept="image/jpeg,image/png,image/webp,application/pdf" kind="pdf" buttonLabel="報告書の画像・PDFを選ぶ" onFiles={(files) => setFile(files[0] ?? null)} />
      <button type="button" onClick={read} disabled={!file || pending} className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-50">
        {pending ? "読み取っています…（30秒ほどかかることがあります）" : "読み取って入力する"}
      </button>
      {message && (
        <div role={message.ok ? "status" : "alert"} className={`rounded-lg p-3 text-base ${message.ok ? "bg-white text-primary" : "border-2 border-gold-line bg-white text-gold"}`}>
          <p className={message.ok ? "font-bold" : ""}>{message.text}</p>
          {message.notes && <p className="mt-2 text-sm text-gray-700">確かめてほしい点：{message.notes}</p>}
        </div>
      )}
    </section>
  );
}
