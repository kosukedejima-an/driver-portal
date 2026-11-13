import Link from "next/link";
import { Suspense } from "react";
import { DriverShell } from "@/components/DriverShell";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { formatDateTime } from "@/lib/format";
import { getSurveySummaries, unansweredCount } from "@/lib/surveys";

async function SurveyList() {
  const list = await getSurveySummaries();
  if (list === null) return <p className="py-8 text-center text-base text-gray-600">アンケートはまだ使えません。</p>;
  if (list.length === 0) return <p className="py-8 text-center text-base text-gray-600">アンケートはありません。</p>;
  const unanswered = unansweredCount(list);
  return (
    <>
      {unanswered > 0 && <p className="mb-3 text-base font-bold text-unread">未回答 {unanswered}件</p>}
      <ul className="flex flex-col gap-3">
        {list.map((s) => {
          const todo = s.open && !s.answered;
          return (
            <li key={s.id}>
              <Link
                href={`/surveys/${s.id}`}
                className={`block rounded-lg bg-white p-4 ${todo ? "border-2 border-unread" : "border border-gray-200"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {todo ? (
                    <span className="text-sm font-bold text-unread">● 未回答</span>
                  ) : s.answered ? (
                    <span className="text-sm text-gray-500">回答済み</span>
                  ) : (
                    <span className="text-sm text-gray-500">締め切り済み</span>
                  )}
                  {s.anonymous && <span className="rounded bg-primary/10 px-2 py-0.5 text-sm text-primary">無記名</span>}
                  {s.is_dummy && <DummyBadge />}
                </div>
                <h3 className="mt-2 text-base font-bold leading-snug">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {s.deadline ? `締め切り：${formatDateTime(s.deadline)}` : "締め切りなし"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function SurveysPage() {
  return (
    <DriverShell title="アンケート">
      <Suspense fallback={<Loading />}>
        <SurveyList />
      </Suspense>
    </DriverShell>
  );
}
