"use client";

import { useActionState, useState, useTransition } from "react";
import { addOffice, deleteOffice, moveOffice, renameOffice, type OfficeResult } from "./actions";

const initial: OfficeResult = { ok: false, message: null };

function Message({ state }: { state: OfficeResult }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-lg p-3 text-base ${state.ok ? "bg-primary/10 text-primary" : "border-2 border-gold-line text-gold"}`}>
      {state.message}
    </p>
  );
}

function OfficeRow({ office, index, last, count }: { office: { id: string; name: string }; index: number; last: boolean; count: number }) {
  const [state, formAction, saving] = useActionState(renameOffice, initial);
  const [result, setResult] = useState<OfficeResult>(initial);
  const [pending, startTransition] = useTransition();
  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        <form action={formAction} className="flex flex-1 gap-2">
          <input type="hidden" name="id" value={office.id} />
          <input name="name" defaultValue={office.name} maxLength={30} required aria-label="営業所の名前" className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-base" />
          <button type="submit" disabled={saving} className="min-h-11 shrink-0 rounded-lg border border-primary px-3 text-sm text-primary">
            名前を変える
          </button>
        </form>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 text-sm text-gray-600">社員 {count}人</span>
        <button type="button" disabled={index === 0 || pending} onClick={() => startTransition(async () => setResult(await moveOffice(office.id, -1)))} aria-label="上へ" className="size-11 rounded-lg border border-gray-300 disabled:opacity-30">
          ↑
        </button>
        <button type="button" disabled={last || pending} onClick={() => startTransition(async () => setResult(await moveOffice(office.id, 1)))} aria-label="下へ" className="size-11 rounded-lg border border-gray-300 disabled:opacity-30">
          ↓
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`営業所「${office.name}」を削除します。よろしいですか？`)) startTransition(async () => setResult(await deleteOffice(office.id)));
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

export function OfficeManager({ offices, counts }: { offices: { id: string; name: string }[]; counts: Record<string, number> }) {
  const [state, formAction, adding] = useActionState(addOffice, initial);
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">営業所を追加</h2>
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <Message state={state} />
          <div className="flex gap-2">
            <input name="name" required maxLength={30} placeholder="例：東営業所" className="min-h-12 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-base" />
            <button type="submit" disabled={adding} className="min-h-12 shrink-0 rounded-lg bg-primary px-4 text-base font-bold text-white">
              追加
            </button>
          </div>
        </form>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">営業所の一覧（この順で表示されます）</h2>
        <ul className="divide-y divide-gray-100">
          {offices.map((o, i) => (
            <OfficeRow key={o.id} office={o} index={i} last={i === offices.length - 1} count={counts[o.id] ?? 0} />
          ))}
        </ul>
        <p className="mt-2 text-sm text-gray-600">資料が入っているジャンルは削除できません。先に資料を別のジャンルに移してください。</p>
      </section>
    </div>
  );
}
