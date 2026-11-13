"use client";

import { useActionState } from "react";
import { createFirstAdmin, type SetupState } from "./actions";

const inputClass = "min-h-12 rounded-lg border border-gray-300 bg-white px-3 text-base";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(createFirstAdmin, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-lg border-2 border-gold-line p-3 text-base text-gold">
          {state.error}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">氏名</span>
        <input name="fullName" required maxLength={50} autoComplete="name" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">社員番号</span>
        <input name="employeeNo" required maxLength={20} inputMode="text" autoComplete="username" className={inputClass} />
        <span className="text-sm text-gray-600">管理者ログインのIDになります（半角の英数字とハイフン）。</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">パスワード（8文字以上）</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className="min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60">
        {pending ? "登録中…" : "最初の管理者を登録する"}
      </button>
    </form>
  );
}
