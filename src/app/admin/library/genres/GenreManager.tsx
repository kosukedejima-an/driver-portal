"use client";

import { useActionState, useState, useTransition } from "react";
import { addGenre, deleteGenre, moveGenre, renameGenre, type LibraryResult } from "../actions";

const initial: LibraryResult = { ok: false, message: null };

function Message({ state }: { state: LibraryResult }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-lg p-3 text-base ${state.ok ? "bg-primary/10 text-primary" : "border-2 border-gold-line text-gold"}`}>
      {state.message}
    </p>
  );
}

function GenreRow({ genre, index, last, count }: { genre: { id: string; name: string }; index: number; last: boolean; count: number }) {
  const [state, formAction, saving] = useActionState(renameGenre, initial);
  const [result, setResult] = useState<LibraryResult>(initial);
  const [pending, startTransition] = useTransition();
  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        <form action={formAction} className="flex flex-1 gap-2">
          <input type="hidden" name="id" value={genre.id} />
          <input name="name" defaultValue={genre.name} maxLength={30} required aria-label="ジャンルの名前" className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-base" />
          <button type="submit" disabled={saving} className="min-h-11 shrink-0 rounded-lg border border-primary px-3 text-sm text-primary">
            名前を変える
          </button>
        </form>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 text-sm text-gray-600">資料 {count}件</span>
        <button type="button" disabled={index === 0 || pending} onClick={() => startTransition(async () => setResult(await moveGenre(genre.id, -1)))} aria-label="上へ" className="size-11 rounded-lg border border-gray-300 disabled:opacity-30">
          ↑
        </button>
        <button type="button" disabled={last || pending} onClick={() => startTransition(async () => setResult(await moveGenre(genre.id, 1)))} aria-label="下へ" className="size-11 rounded-lg border border-gray-300 disabled:opacity-30">
          ↓
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`ジャンル「${genre.name}」を削除します。よろしいですか？`)) startTransition(async () => setResult(await deleteGenre(genre.id)));
          }}
          className="min-h-11 rounded-lg border-2 border-gold-line px-3 text-sm text-gold"
        >
          削除
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <Message state={state} />
        <Message state={result} />
      </div>
    </li>
  );
}

export function GenreManager({ genres, counts }: { genres: { id: string; name: string }[]; counts: Record<string, number> }) {
  const [state, formAction, adding] = useActionState(addGenre, initial);
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">ジャンルを追加</h2>
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <Message state={state} />
          <div className="flex gap-2">
            <input name="name" required maxLength={30} placeholder="例：冬の運行" className="min-h-12 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-base" />
            <button type="submit" disabled={adding} className="min-h-12 shrink-0 rounded-lg bg-primary px-4 text-base font-bold text-white">
              追加
            </button>
          </div>
        </form>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">ジャンルの一覧（この順で表示されます）</h2>
        <ul className="divide-y divide-gray-100">
          {genres.map((g, i) => (
            <GenreRow key={g.id} genre={g} index={i} last={i === genres.length - 1} count={counts[g.id] ?? 0} />
          ))}
        </ul>
        <p className="mt-2 text-sm text-gray-600">資料が入っているジャンルは削除できません。先に資料を別のジャンルに移してください。</p>
      </section>
    </div>
  );
}
