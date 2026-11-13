"use client";

import { useActionState } from "react";
import { adminLogin, driverLogin, type LoginState } from "./actions";

const initialState: LoginState = { error: null };
const inputClass = "min-h-12 rounded-lg border border-gray-300 bg-white px-3 text-lg";

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
      {error}
    </p>
  );
}

/** ドライバー用：社員番号だけ */
export function DriverLoginForm() {
  const [state, formAction, pending] = useActionState(driverLogin, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ErrorMessage error={state.error} />
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">社員番号</span>
        <input
          name="employeeNo"
          required
          maxLength={20}
          autoComplete="username"
          inputMode="text"
          autoCapitalize="none"
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60"
      >
        {pending ? "確認中…" : "入る"}
      </button>
      <p className="text-sm text-gray-600">
        一度入ると、ログアウトするまでこのスマホが覚えています。入れない場合は営業所の管理者に連絡してください。
      </p>
    </form>
  );
}

/** 管理者用：社員番号（またはメールアドレス）とパスワード */
export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ErrorMessage error={state.error} />
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">社員番号</span>
        <input
          name="loginId"
          required
          autoComplete="username"
          inputMode="text"
          autoCapitalize="none"
          className={inputClass}
        />
        <span className="text-sm text-gray-600">メールアドレスで登録した管理者は、メールアドレスを入力してください</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">パスワード</span>
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 min-h-14 rounded-lg bg-primary text-lg font-bold text-white disabled:opacity-60"
      >
        {pending ? "ログイン中…" : "管理者としてログイン"}
      </button>
    </form>
  );
}
