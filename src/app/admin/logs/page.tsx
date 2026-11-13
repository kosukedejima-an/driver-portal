import { Suspense } from "react";
import { AdminNoticeNav } from "@/components/AdminNoticeNav";
import { AdminShell } from "@/components/AdminShell";
import { AuditLogList } from "@/components/AuditLogList";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import type { AuditLog } from "@/lib/types";

const LIMIT = 100;

async function Logs() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("notice_audit_logs")
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
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <AuditLogList logs={data as AuditLog[]} showTitle />
    </section>
  );
}

export default function AdminLogsPage() {
  return (
    <AdminShell current="/admin/reads" width="narrow">
      <AdminNoticeNav current="/admin/logs" />
      <p className="text-sm text-gray-600">
        お知らせの投稿・編集・非表示・再表示・完全削除の記録です（新しい順に{LIMIT}件）。記録は書き換え・削除できません。
      </p>
      <Suspense fallback={<Loading />}>
        <Logs />
      </Suspense>
    </AdminShell>
  );
}
