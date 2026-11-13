import Link from "next/link";
import { ACTION_LABELS, FIELD_LABELS } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

/** 操作記録の一覧（だれが・いつ・何をしたか） */
export function AuditLogList({ logs, showTitle = false }: { logs: AuditLog[]; showTitle?: boolean }) {
  if (logs.length === 0) {
    return <p className="text-base text-gray-600">記録はまだありません。</p>;
  }
  return (
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
            <span className="text-base">{log.actor_name ?? "（削除された社員）"}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{formatDateTime(log.created_at)}</p>
          {showTitle &&
            (log.action === "delete" ? (
              <p className="mt-1 text-base">{log.notice_title}</p>
            ) : (
              <Link href={`/admin/reads/${log.notice_id}`} className="mt-1 block text-base text-primary underline">
                {log.notice_title}
              </Link>
            ))}
          {log.changed_fields && (
            <p className="mt-1 text-sm text-gray-600">
              変更した項目：{log.changed_fields.map((f) => FIELD_LABELS[f] ?? f).join("、")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
