import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ACTION_LABELS, type EmployeeLog } from "./labels";

const LIMIT = 200;

async function Logs() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("employee_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。
      </p>
    );
  }
  const logs = data as EmployeeLog[];
  if (logs.length === 0) return <p className="text-base text-gray-600">記録はまだありません。</p>;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <ul className="divide-y divide-gray-100">
        {logs.map((log) => (
          <li key={log.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-sm font-bold ${
                  log.action === "delete" ? "bg-gold text-white" : "bg-primary/10 text-primary"
                }`}
              >
                {ACTION_LABELS[log.action]}
              </span>
              <span className="text-base font-bold">{log.target_name}</span>
              {log.target_employee_no && <span className="text-sm text-gray-600">（社員番号 {log.target_employee_no}）</span>}
            </div>
            {log.details?.map((d) => (
              <p key={d} className="mt-1 text-sm text-gray-700">
                {d}
              </p>
            ))}
            <p className="mt-1 text-sm text-gray-600">
              {formatDateTime(log.created_at)}・操作した人：{log.actor_name ?? "アプリ以外（SQL Editor など）"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EmployeeLogsPage() {
  return (
    <AdminShell current="/admin/users" width="narrow">
      <Link href="/admin/users" className="flex min-h-11 items-center text-base text-primary">
        ‹ 社員管理に戻る
      </Link>
      <h2 className="text-lg font-bold">社員の変更記録</h2>
      <p className="text-sm text-gray-600">
        登録・編集・権限の変更・退職・再開・完全削除の記録です（新しい順に{LIMIT}件）。記録は書き換え・削除できません。
      </p>
      <Suspense fallback={<Loading />}>
        <Logs />
      </Suspense>
    </AdminShell>
  );
}
