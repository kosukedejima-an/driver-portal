import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { RateBar } from "@/components/RateBar";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, rate } from "@/lib/format";
import { isOpen, type Survey } from "@/lib/surveys";

async function SurveyAdminList() {
  const { supabase } = await requireAdmin();
  const [surveysRes, driversRes] = await Promise.all([
    supabase.from("surveys").select("*").order("published_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "driver").eq("is_active", true),
  ]);
  if (surveysRes.error) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。
      </p>
    );
  }
  const surveys = surveysRes.data as Survey[];
  const total = driversRes.count ?? 0;
  // 回答した人数（利用中のドライバーだけ数える）
  const counts = await Promise.all(
    surveys.map((s) =>
      supabase
        .from("survey_responses")
        .select("id, profiles!inner(role, is_active)", { count: "exact", head: true })
        .eq("survey_id", s.id)
        .eq("profiles.role", "driver")
        .eq("profiles.is_active", true)
        .then((r) => r.count ?? 0),
    ),
  );
  if (surveys.length === 0) return <p className="py-8 text-center text-base text-gray-600">アンケートはまだありません。</p>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {surveys.map((s, i) => (
        <li key={s.id}>
          <Link href={`/admin/surveys/${s.id}`} className="block h-full rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              {s.hidden_at ? (
                <span className="rounded bg-gray-600 px-2 py-0.5 text-sm font-bold text-white">非表示中</span>
              ) : isOpen(s) ? (
                <span className="rounded bg-primary px-2 py-0.5 text-sm font-bold text-white">受付中</span>
              ) : (
                <span className="rounded bg-gray-200 px-2 py-0.5 text-sm text-gray-700">締め切り済み</span>
              )}
              {s.anonymous && <span className="rounded bg-primary/10 px-2 py-0.5 text-sm text-primary">無記名</span>}
              {s.is_dummy && <DummyBadge />}
            </div>
            <h2 className="mt-2 text-base font-bold leading-snug">{s.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{s.deadline ? `締め切り：${formatDateTime(s.deadline)}` : "締め切りなし"}</p>
            <div className="mt-3 flex items-center gap-3">
              <RateBar read={counts[i]} total={total} />
              <span className="shrink-0 text-sm font-bold">
                回答 {counts[i]}/{total}人（{rate(counts[i], total)}%）
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function DoneMessage({ searchParams }: { searchParams: PageProps<"/admin/surveys">["searchParams"] }) {
  const { done } = await searchParams;
  if (done !== "deleted") return null;
  return <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">アンケートを完全に削除しました。</p>;
}

export default function AdminSurveysPage({ searchParams }: PageProps<"/admin/surveys">) {
  return (
    <AdminShell current="/admin/surveys">
      <Suspense fallback={null}>
        <DoneMessage searchParams={searchParams} />
      </Suspense>
      <Link href="/admin/surveys/new" className="flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white lg:max-w-xs lg:px-6">
        ＋ 新しいアンケートを作る
      </Link>
      <p className="text-sm text-gray-600">回答率は、利用中のドライバーの人数で計算しています。</p>
      <Suspense fallback={<Loading />}>
        <SurveyAdminList />
      </Suspense>
    </AdminShell>
  );
}
