import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { DummyBadge } from "@/components/DummyBadge";
import { LikersSection } from "@/components/LikersSection";
import { Loading } from "@/components/Loading";
import { RateBar } from "@/components/RateBar";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/fetch-all";
import { formatDateTime, rate } from "@/lib/format";
import { isOpen, type Survey, type SurveyQuestion } from "@/lib/surveys";
import type { Office, Profile } from "@/lib/types";
import { SurveyControls } from "./SurveyControls";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 日時 → 入力欄用の「2026-11-10T17:00」（日本時間） */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

async function Results({ params }: { params: PageProps<"/admin/surveys/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const { data: survey } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle<Survey>();
  if (!survey) notFound();
  const [qRes, officesRes, drivers, responses, countsRes, textsRes] = await Promise.all([
    supabase.from("survey_questions").select("*").eq("survey_id", id).order("position"),
    supabase.from("offices").select("id, name").order("sort_order"),
    fetchAll<Profile>((f, t) => supabase.from("profiles").select("*").eq("role", "driver").eq("is_active", true).order("employee_no").range(f, t)),
    fetchAll<{ user_id: string }>((f, t) => supabase.from("survey_responses").select("user_id").eq("survey_id", id).range(f, t)),
    supabase.rpc("survey_choice_counts", { p_survey: id }),
    supabase.rpc("survey_text_answers", { p_survey: id }),
  ]);
  const questions = (qRes.data ?? []) as SurveyQuestion[];
  const offices = (officesRes.data ?? []) as Office[];
  const answeredIds = new Set(responses.map((r) => r.user_id));
  const total = drivers.length;
  const answered = drivers.filter((d) => answeredIds.has(d.id)).length;
  const votes = new Map(
    ((countsRes.data ?? []) as { question_id: string; option_index: number; votes: number }[]).map((c) => [`${c.question_id}:${c.option_index}`, Number(c.votes)]),
  );
  const texts = (textsRes.data ?? []) as { question_id: string; text_value: string; respondent: string | null; office: string | null }[];
  const groups = [
    ...offices.map((o) => ({ key: o.id, name: o.name, members: drivers.filter((d) => d.office_id === o.id) })),
    { key: "none", name: "営業所未設定", members: drivers.filter((d) => !offices.some((o) => o.id === d.office_id)) },
  ].filter((g) => g.members.length > 0);
  const respondents = responses.length;

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <section className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          {survey.hidden_at ? (
            <span className="rounded bg-gray-600 px-2 py-0.5 text-sm font-bold text-white">非表示中</span>
          ) : isOpen(survey) ? (
            <span className="rounded bg-primary px-2 py-0.5 text-sm font-bold text-white">受付中</span>
          ) : (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-sm text-gray-700">締め切り済み</span>
          )}
          {survey.anonymous && <span className="rounded bg-primary/10 px-2 py-0.5 text-sm text-primary">無記名</span>}
          {survey.is_dummy && <DummyBadge />}
        </div>
        <h2 className="mt-2 text-lg font-bold leading-snug">{survey.title}</h2>
        <p className="mt-1 text-sm text-gray-600">
          公開：{formatDateTime(survey.published_at)}　／　{survey.deadline ? `締め切り：${formatDateTime(survey.deadline)}` : "締め切りなし"}
        </p>
        <div className="mt-4">
          <SurveyControls
            id={survey.id}
            title={survey.title}
            description={survey.description ?? ""}
            deadlineLocal={toLocalInput(survey.deadline)}
            hidden={Boolean(survey.hidden_at)}
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">回答状況（利用中のドライバー）</h3>
        <p className="mt-2 text-base">
          <span className="text-3xl font-bold">{answered}</span> / {total}人 回答済み
          <span className="ml-2 text-xl font-bold">（{rate(answered, total)}%）</span>
        </p>
        <div className="mt-3">
          <RateBar read={answered} total={total} size="lg" />
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {groups.map((g) => {
            const n = g.members.filter((d) => answeredIds.has(d.id)).length;
            return (
              <li key={g.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold">{g.name}</span>
                  <span className="text-sm">
                    {n}/{g.members.length}人（{rate(n, g.members.length)}%）
                  </span>
                </div>
                <div className="mt-1">
                  <RateBar read={n} total={g.members.length} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {questions.map((q, i) => (
        <section key={q.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-base font-bold leading-snug">
            <span className="text-primary">Q{i + 1}．</span>
            {q.text}
          </h3>
          {q.kind === "text" ? (
            (() => {
              const list = texts.filter((t) => t.question_id === q.id);
              return list.length === 0 ? (
                <p className="mt-2 text-base text-gray-600">回答はまだありません。</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100">
                  {list.map((t, k) => (
                    <li key={k} className="py-2">
                      <p className="text-base whitespace-pre-wrap">{t.text_value}</p>
                      {t.respondent && (
                        <p className="text-sm text-gray-600">
                          {t.respondent}（{t.office ?? "営業所未設定"}）
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              );
            })()
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {q.options.map((opt, k) => {
                const n = votes.get(`${q.id}:${k}`) ?? 0;
                return (
                  <li key={k}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base">{opt}</span>
                      <span className="shrink-0 text-sm font-bold">
                        {n}人（{rate(n, respondents)}%）
                      </span>
                    </div>
                    <div className="mt-1">
                      <RateBar read={n} total={respondents} />
                    </div>
                  </li>
                );
              })}
              <li className="text-sm text-gray-600">
                割合は回答した{respondents}人に対する割合です{q.kind === "multi" ? "（いくつでも選べるため、合計は100%を超えます）" : ""}。
              </li>
            </ul>
          )}
        </section>
      ))}

      <LikersSection type="survey" id={survey.id} />

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-base font-bold">
          未回答者一覧 <span className="text-gold">（{total - answered}人）</span>
        </h3>
        {survey.anonymous && <p className="mt-1 text-sm text-gray-600">無記名のアンケートでも、声かけのため「回答したかどうか」だけは分かります。</p>}
        {answered === total ? (
          <p className="mt-3 text-base">{total === 0 ? "ドライバーがまだ登録されていません。" : "全員が回答済みです。"}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {groups.map((g) => {
              const not = g.members.filter((d) => !answeredIds.has(d.id));
              if (not.length === 0) return null;
              return (
                <div key={g.key}>
                  <p className="text-sm font-bold text-gray-600">{g.name}</p>
                  <ul className="mt-1 divide-y divide-gray-100">
                    {not.map((d) => (
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
    </div>
  );
}

async function DoneMessage({ searchParams }: { searchParams: PageProps<"/admin/surveys/[id]">["searchParams"] }) {
  const { done } = await searchParams;
  if (done !== "created") return null;
  return (
    <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">
      アンケートを公開しました。社員のスマホに通知を送っています。回答状況はこの画面で確認できます。
    </p>
  );
}

export default function SurveyResultPage({ params, searchParams }: PageProps<"/admin/surveys/[id]">) {
  return (
    <AdminShell current="/admin/surveys">
      <Link href="/admin/surveys" className="flex min-h-11 items-center text-base text-primary">
        ‹ アンケートの一覧に戻る
      </Link>
      <Suspense fallback={null}>
        <DoneMessage searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <Results params={params} />
      </Suspense>
    </AdminShell>
  );
}
