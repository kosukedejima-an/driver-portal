import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { Office, Profile } from "@/lib/types";
import { EditEmployeeForm } from "../../forms";
import { ACTION_LABELS, type EmployeeLog } from "../../logs/labels";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditContent({ params }: { params: PageProps<"/admin/users/[id]/edit">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [profileRes, officesRes, logsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile & { company?: string }>(),
    supabase.from("offices").select("id, name").order("sort_order"),
    supabase.from("employee_audit_logs").select("*").eq("target_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  const profile = profileRes.data;
  if (!profile) notFound();
  const logs = (logsRes.data ?? []) as EmployeeLog[];

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-bold">
          {profile.full_name}さんの情報を直す
          {profile.is_active === false && <span className="ml-2 text-sm text-gray-600">（退職・利用停止中）</span>}
        </h2>
        <EditEmployeeForm profile={profile} offices={(officesRes.data ?? []) as Office[]} />
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">この社員の変更記録</h3>
        {logsRes.error ? (
          <p className="mt-2 text-base text-gray-600">データベースの設定（supabase/setup.sql）を実行すると表示されます。</p>
        ) : logs.length === 0 ? (
          <p className="mt-2 text-base text-gray-600">記録はまだありません。</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {logs.map((log) => (
              <li key={log.id} className="py-2">
                <p className="text-base">
                  <span className="font-bold">{ACTION_LABELS[log.action]}</span>
                  <span className="text-sm text-gray-600">　{formatDateTime(log.created_at)}・{log.actor_name ?? "アプリ以外（SQL Editor など）"}</span>
                </p>
                {log.details?.map((d) => (
                  <p key={d} className="text-sm text-gray-600">
                    {d}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function EditEmployeePage({ params }: PageProps<"/admin/users/[id]/edit">) {
  return (
    <AdminShell current="/admin/users" width="narrow">
      <Link href="/admin/users" className="flex min-h-11 items-center text-base text-primary">
        ‹ 社員管理に戻る
      </Link>
      <Suspense fallback={<Loading />}>
        <EditContent params={params} />
      </Suspense>
    </AdminShell>
  );
}
