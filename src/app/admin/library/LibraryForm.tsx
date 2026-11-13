"use client";

import { useState, useTransition } from "react";
import { FilePicker } from "@/components/FilePicker";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { createClient } from "@/lib/supabase/client";
import { prepareUploads, saveLibraryItem } from "./actions";

const inputClass = "min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base";

type Existing = { path: string; url: string | null };

/** 情報集の資料の登録・更新フォーム。item を渡すと更新、渡さなければ新規登録 */
export function LibraryForm({
  genres,
  item,
}: {
  genres: { id: string; name: string }[];
  item?: {
    id: string;
    genre_id: string;
    title: string;
    body: string | null;
    photos: Existing[];
    pdf: { path: string; name: string } | null;
    requiresConfirm: boolean;
  };
}) {
  const isEdit = Boolean(item);
  const [genreId, setGenreId] = useState(item?.genre_id ?? genres[0]?.id ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [photos, setPhotos] = useState<Existing[]>(item?.photos ?? []);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [pdf, setPdf] = useState<{ path: string; name: string } | null>(item?.pdf ?? null);
  const [newPdf, setNewPdf] = useState<File | null>(null);
  const [notify, setNotify] = useState(true);
  const [requireConfirm, setRequireConfirm] = useState(item?.requiresConfirm ?? false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // 1. 写真は縮小してから、写真・PDFを置き場所へ直接送る
      setStatus("ファイルを送っています…");
      const files = [...(await Promise.all(newPhotos.map(shrinkPhoto))), ...(newPdf ? [newPdf] : [])];
      let uploaded: string[] = [];
      if (files.length) {
        const prepared = await prepareUploads(files.map((f) => ({ type: f.type, size: f.size })));
        if ("error" in prepared) {
          setStatus(null);
          return setError(prepared.error);
        }
        const supabase = createClient();
        const results = await Promise.all(
          files.map((f, i) => supabase.storage.from("library-files").uploadToSignedUrl(prepared.uploads[i].path, prepared.uploads[i].token, f, { contentType: f.type })),
        );
        if (results.some((r) => r.error)) {
          setStatus(null);
          return setError("ファイルを送れませんでした。通信状態を確認して、もう一度お試しください。");
        }
        uploaded = prepared.uploads.map((u) => u.path);
      }
      const newPhotoPaths = uploaded.slice(0, newPhotos.length);
      const newPdfPath = newPdf ? uploaded[uploaded.length - 1] : null;

      // 2. 内容を保存する
      setStatus("保存しています…");
      const result = await saveLibraryItem({
        id: item?.id,
        genreId,
        title,
        body,
        photoPaths: [...photos.map((p) => p.path), ...newPhotoPaths],
        pdf: newPdfPath ? { path: newPdfPath, name: newPdf!.name } : pdf,
        notify: isEdit ? notify : true,
        requireConfirm,
      });
      setStatus(null);
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
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">ジャンル</span>
        <select value={genreId} onChange={(e) => setGenreId(e.target.value)} className={inputClass}>
          {genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">題名</span>
        <input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">本文</span>
        <textarea rows={10} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} className="rounded-lg border border-gray-300 p-3 text-base leading-relaxed" />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-base font-bold">写真（10枚まで）</span>
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li key={p.path} className="relative">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 期限付きURLの写真のため通常の img を使う
                  <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ) : (
                  <div className="aspect-square w-full rounded-lg bg-gray-100" />
                )}
                <button
                  type="button"
                  onClick={() => setPhotos((ps) => ps.filter((x) => x.path !== p.path))}
                  className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 text-sm"
                >
                  外す
                </button>
              </li>
            ))}
          </ul>
        )}
        <FilePicker
          accept="image/jpeg,image/png,image/webp"
          multiple
          kind="photo"
          buttonLabel={photos.length > 0 ? "写真を追加する" : "写真を選ぶ"}
          onFiles={(files) => setNewPhotos(files.slice(0, Math.max(0, 10 - photos.length)))}
        />
        {newPhotos.length > 0 && <span className="text-sm text-gray-600">追加する写真：{newPhotos.length}枚（10枚をこえる分は入りません）</span>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-base font-bold">PDF（1つ、20MBまで）</span>
        {pdf && !newPdf && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2">
            <span className="text-sm break-all">{pdf.name}</span>
            <button type="button" onClick={() => setPdf(null)} className="min-h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm">
              外す
            </button>
          </div>
        )}
        <FilePicker accept="application/pdf" kind="pdf" buttonLabel={pdf ? "PDFを差し替える" : "PDFを選ぶ"} onFiles={(files) => setNewPdf(files[0] ?? null)} />
        {pdf && newPdf && <span className="text-sm text-gray-600">今のPDF（{pdf.name}）を差し替えます</span>}
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-lg border border-gray-300 p-3 text-base">
        <input
          type="checkbox"
          checked={requireConfirm}
          onChange={(e) => setRequireConfirm(e.target.checked)}
          className="mt-1 size-5 accent-[#701648]"
        />
        <span>
          <span className="font-bold">確認ボタンを付ける</span>
          <span className="block text-sm text-gray-600">
            安全のルールなど、読んだ記録を残したい大事な資料に付けます。ドライバーが「内容を確認しました」を押すまで「未確認」の印が付き、だれが確認したかが分かります。付けない資料は、開いた時点で「見た」になります。
          </span>
        </span>
      </label>

      {isEdit && (
        <label className="flex min-h-11 items-start gap-3 rounded-lg border-2 border-gold-line p-3 text-base">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1 size-5 accent-[#701648]" />
          <span>
            <span className="font-bold">「更新」として知らせる</span>
            <span className="block text-sm text-gray-600">
              社員のスマホに通知し、見ていない人には「更新」の印を付けます。誤字直しなどの小さな修正なら、チェックを外してください。
            </span>
          </span>
        </label>
      )}
      {!isEdit && <p className="text-sm text-gray-600">登録すると、社員のスマホに「新しい資料が追加されました」と通知します。</p>}

      {status && <p role="status" className="text-base text-primary">{status}</p>}
      <button type="submit" disabled={pending} className="min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60">
        {pending ? "保存中…" : isEdit ? "保存する" : "登録する"}
      </button>
    </form>
  );
}
