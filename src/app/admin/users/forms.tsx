"use client";

import { siteConfig } from "@/config/site";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { Office } from "@/lib/types";
import { changeRole, changeStatus, createEmployee, deleteEmployee, editEmployee, resetPassword, type FormState } from "./actions";

const initialState: FormState = { ok: false, message: null };
const inputClass = "min-h-12 rounded-lg border border-gray-300 bg-white px-3 text-base";

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-lg p-3 text-base ${state.ok ? "bg-primary/10 text-primary" : "border-2 border-gold-line text-gold"}`}
    >
      {state.message}
    </p>
  );
}

export function AddEmployeeForm({ offices }: { offices: Office[] }) {
  const [state, formAction, pending] = useActionState(createEmployee, initialState);
  const [role, setRole] = useState<"driver" | "admin">("driver");
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">社員番号</span>
        <input name="employeeNo" required maxLength={20} autoCapitalize="none" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">氏名</span>
        <input name="fullName" required maxLength={50} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">営業所</span>
        <select name="officeId" className={inputClass} defaultValue={offices[0]?.id ?? ""}>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">役割</span>
        <select
          name="role"
          className={inputClass}
          value={role}
          onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "driver")}
        >
          <option value="driver">ドライバー</option>
          <option value="admin">管理者</option>
        </select>
      </label>
      {role === "admin" ? (
        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">パスワード（8文字以上）</span>
          <input name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          <span className="text-sm text-gray-600">管理者用の入口で使います</span>
        </label>
      ) : (
        <p className="text-sm text-gray-600">ドライバーは社員番号だけで入れます（パスワードは不要です）。</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60"
      >
        {pending ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="userId" value={userId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">新しいパスワード（8文字以上）</span>
        <input name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg border-2 border-primary text-base font-bold text-primary disabled:opacity-60"
      >
        {pending ? "変更中…" : "パスワードを再設定"}
      </button>
    </form>
  );
}

/** 権限の切り替えボタン（自分自身の行には出さない） */
export function RoleToggle({ userId, role, name }: { userId: string; role: "driver" | "admin"; name: string }) {
  const [state, setState] = useState<FormState>(initialState);
  const [pending, startTransition] = useTransition();
  const toAdmin = role === "driver";

  const onClick = () => {
    const question = toAdmin
      ? `この社員を管理者にしますか？\n（${name}さん。管理者メニューが使えるようになります）`
      : `この社員をドライバーに戻しますか？\n（${name}さん。管理者メニューが使えなくなります）`;
    if (!window.confirm(question)) return;
    startTransition(async () => setState(await changeRole(userId, toAdmin ? "admin" : "driver")));
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Message state={state} />
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="min-h-11 rounded-lg border-2 border-primary bg-white px-4 text-base font-bold text-primary disabled:opacity-60"
      >
        {pending ? "変更中…" : toAdmin ? "管理者にする" : "ドライバーに戻す"}
      </button>
    </div>
  );
}

/** 操作の結果を一覧の上に出す（今の絞り込み条件はそのまま） */
function showDone(router: ReturnType<typeof useRouter>, done: "retired" | "resumed" | "deleted") {
  const params = new URLSearchParams(window.location.search);
  params.set("done", done);
  router.replace(`/admin/users?${params.toString()}`, { scroll: true });
}

/** 利用停止・再開のボタン（自分自身の行には出さない） */
export function StatusToggle({ userId, active, name }: { userId: string; active: boolean; name: string }) {
  const [state, setState] = useState<FormState>(initialState);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    const question = active
      ? `この社員を退職（利用停止）にしますか？\n（${name}さん。この社員番号では入れなくなり、既読確認の人数にも含めなくなります。これまでの既読記録は残ります）`
      : `この社員の利用を再開しますか？\n（${name}さん。また社員番号で入れるようになります）`;
    if (!window.confirm(question)) return;
    startTransition(async () => {
      const result = await changeStatus(userId, !active);
      // うまくいくと、この社員は今の一覧から消えるため、結果は画面の上に出す
      if (result.ok) showDone(router, active ? "retired" : "resumed");
      else setState(result);
    });
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Message state={state} />
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`min-h-11 rounded-lg border-2 bg-white px-4 text-base font-bold disabled:opacity-60 ${
          active ? "border-gold-line text-gold" : "border-primary text-primary"
        }`}
      >
        {pending ? "変更中…" : active ? "退職（利用停止）にする" : "利用を再開する"}
      </button>
    </div>
  );
}

/** 完全削除のボタン（退職者だけに出す） */
export function DeleteEmployeeButton({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<FormState>(initialState);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const onClick = () => {
    if (!window.confirm(`既読記録も消えます。よろしいですか？\n（${name}さんを完全に削除します。元に戻せません）`)) return;
    startTransition(async () => {
      const result = await deleteEmployee(userId);
      if (result.ok) showDone(router, "deleted");
      else setState(result);
    });
  };
  return (
    <div className="mt-2 flex flex-col gap-2">
      <Message state={state} />
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="min-h-11 rounded-lg border-2 border-gold-line bg-white px-4 text-base font-bold text-gold disabled:opacity-60"
      >
        {pending ? "削除中…" : "完全に削除する"}
      </button>
    </div>
  );
}

/** 社員の編集（氏名・社員番号・営業所・会社） */
export function EditEmployeeForm({
  profile,
  offices,
}: {
  profile: { id: string; employee_no: string | null; full_name: string; office_id: string | null; company?: string };
  offices: Office[];
}) {
  const [state, formAction, pending] = useActionState(editEmployee, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="userId" value={profile.id} />
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">氏名</span>
        <input name="fullName" required maxLength={50} defaultValue={profile.full_name} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">社員番号</span>
        <input
          name="employeeNo"
          required
          maxLength={20}
          autoCapitalize="none"
          defaultValue={profile.employee_no ?? ""}
          className={inputClass}
        />
        <span className="text-sm text-gray-600">変えると、次からは新しい番号で入ります。これまでの既読記録はそのまま引き継がれます。</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">営業所</span>
        <select name="officeId" required defaultValue={profile.office_id ?? offices[0]?.id ?? ""} className={inputClass}>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {/* 所属会社が2社以上あるときだけ出す（src/config/site.ts の companies） */}
      {siteConfig.companies.length > 1 && (
        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">会社</span>
          <select name="company" defaultValue={profile.company || siteConfig.companies[0]} className={inputClass}>
            {siteConfig.companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60"
      >
        {pending ? "保存中…" : "保存する"}
      </button>
    </form>
  );
}
