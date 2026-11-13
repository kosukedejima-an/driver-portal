import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { AuditLogList } from "@/components/AuditLogList";
import { CategoryBadge } from "@/components/CategoryBadge";
import { DummyBadge } from "@/components/DummyBadge";
import { LikersSection } from "@/components/LikersSection";
import { Loading } from "@/components/Loading";
import { NoticeAdminActions } from "@/components/NoticeAdminActions";
import { RateBar } from "@/components/RateBar";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, rate } from "@/lib/format";
import type { AuditLog, Notice, Office, Profile } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ReadDetail({ params }: { params: PageProps<"/admin/reads/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const [noticeRes, officesRes, driversRes, readsRes, logsRes] = await Promise.all([
    supabase.from("notices").select("*").eq("id", id).maybeSingle<Notice>(),
    supabase.from("offices").select("id, name").order("sort_order"),
    supabase.from("profiles").select("*").eq("role", "driver").order("employee_no"),
    supabase.from("notice_reads").select("user_id").eq("notice_id", id),
    supabase.from("notice_audit_logs").select("*").eq("notice_id", id).order("created_at", { ascending: false }),
  ]);
  if (noticeRes.error) throw noticeRes.error;
  const notice = noticeRes.data;
  if (!notice) notFound();

  const offices = (officesRes.data ?? []) as Office[];
  // 利用停止中のドライバーは数えない
  const drivers = ((driversRes.data ?? []) as Profile[]).filter((d) => d.is_active !== false);
  const readIds = new Set((readsRes.data ?? []).map((r) => r.user_id as string));

  const total = drivers.length;
  const readCount = drivers.filter((d) => readIds.has(d.id)).length;
  // 営業所が未設定のドライバーも漏れなく表示する
  const groups = [
    ...offices.map((o) => ({ key: o.id, name: o.name, members: drivers.filter((d) => d.office_id === o.id) })),
    { key: "none", name: "営業所未設定", members: drivers.filter((d) => !offices.some((o) => o.id === d.office_id)) },
  ].filter((g) => g.members.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <section className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={notice.category} />
          <span className="text-sm text-gray-600">{formatDate(notice.published_at)}</span>
          {notice.is_dummy && <DummyBadge />}
          {notice.hidden_at && (
            <span className="rounded bg-gray-600 px-2 py-0.5 text-sm font-bold text-white">非表示中</span>
          )}
        </div>
        <h2 className="mt-2 text-lg font-bold leading-snug">{notice.title}</h2>
        {notice.hidden_at && (
          <p className="mt-2 text-sm text-gray-600">
            {formatDateTime(notice.hidden_at)}に非表示にしました。ドライバーの画面には表示されていません。
          </p>
        )}
        <div className="mt-4">
          <NoticeAdminActions noticeId={notice.id} hidden={Boolean(notice.hidden_at)} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">確認状況</h3>
        <p className="mt-2 text-base">
          <span className="text-3xl font-bold">{readCount}</span>
          <span> / {total}人 確認済み</span>
          <span className="ml-2 text-xl font-bold">（{rate(readCount, total)}%）</span>
        </p>
        <div className="mt-3">
          <RateBar read={readCount} total={total} size="lg" />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">営業所別の確認状況</h3>
        {groups.length === 0 ? (
          <p className="mt-3 text-base text-gray-600">ドライバーがまだ登録されていません。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {groups.map((g) => {
              const read = g.members.filter((d) => readIds.has(d.id)).length;
              return (
                <li key={g.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold">{g.name}</span>
                    <span className="text-sm">
                      {read}/{g.members.length}人（{rate(read, g.members.length)}%）
                    </span>
                  </div>
                  <div className="mt-1">
                    <RateBar read={read} total={g.members.length} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">
          未確認者一覧 <span className="text-gold">（{total - readCount}人）</span>
        </h3>
        {readCount === total ? (
          <p className="mt-3 text-base">{total === 0 ? "ドライバーがまだ登録されていません。" : "全員が確認済みです。"}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {groups.map((g) => {
              const unread = g.members.filter((d) => !readIds.has(d.id));
              if (unread.length === 0) return null;
              return (
                <div key={g.key}>
                  <p className="text-sm font-bold text-gray-600">{g.name}</p>
                  <ul className="mt-1 divide-y divide-gray-100">
                    {unread.map((d) => (
                      <li key={d.id} className="flex min-h-11 items-center justify-between text-base">
                        <span>{d.full_name}</span>
                        <span className="text-sm text-gray-600">{d.employee_no}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <LikersSection type="notice" id={notice.id} />

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">操作の記録</h3>
        {logsRes.error ? (
          <p className="mt-2 text-base text-gray-600">
            データベースの設定（supabase/setup.sql）を実行すると、ここに記録が表示されます。
          </p>
        ) : (
          <AuditLogList logs={logsRes.data as AuditLog[]} />
        )}
      </section>
    </div>
  );
}

const DONE_MESSAGES: Record<string, string> = {
  posted: "お知らせを投稿しました。ドライバーの確認状況はこの画面で確認できます。",
  edited: "変更を保存しました。",
};

/** 投稿・編集の直後にお知らせを表示する */
async function PostedMessage({ searchParams }: Pick<PageProps<"/admin/reads/[id]">, "searchParams">) {
  const { done } = await searchParams;
  const message = typeof done === "string" ? DONE_MESSAGES[done] : undefined;
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">
      {message}
    </p>
  );
}

export default function AdminReadDetailPage({ params, searchParams }: PageProps<"/admin/reads/[id]">) {
  return (
    <AdminShell current="/admin/reads">
      <Suspense fallback={null}>
        <PostedMessage searchParams={searchParams} />
      </Suspense>
      <Link href="/admin/reads" className="flex min-h-11 items-center text-base text-primary">
        ‹ お知らせの一覧に戻る
      </Link>
      <Suspense fallback={<Loading />}>
        <ReadDetail params={params} />
      </Suspense>
    </AdminShell>
  );
}
