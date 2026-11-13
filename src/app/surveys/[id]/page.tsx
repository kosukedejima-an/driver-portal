import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/format";
import { getSurveyForAnswer } from "@/lib/surveys";
import { getLikes } from "@/lib/timeline";
import { LikeButton } from "@/components/LikeButton";
import { SurveyForm } from "./SurveyForm";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function SurveyContent({ params }: { params: PageProps<"/surveys/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const [data, likes] = await Promise.all([getSurveyForAnswer(id), getLikes("survey", [id])]);
  if (!data) notFound();
  const { survey, questions, response, myAnswers, open } = data;

  return (
    <>
      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-xl font-bold leading-snug">{survey.title}</h2>
        {survey.description && <p className="mt-2 text-base leading-relaxed whitespace-pre-wrap">{survey.description}</p>}
        <p className="mt-2 text-sm text-gray-600">
          {survey.deadline ? `締め切り：${formatDateTime(survey.deadline)}` : "締め切りなし"}
          {response && `　／　回答済み（${formatDateTime(response.updated_at ?? response.submitted_at)}）`}
        </p>
        {survey.anonymous && (
          <p className="mt-2 rounded bg-primary/10 p-2 text-sm text-primary">
            このアンケートは無記名です。だれが何と答えたかは、管理者にも分かりません。
          </p>
        )}
        {likes.enabled && (
          <div className="mt-3 flex justify-end">
            <LikeButton type="survey" id={survey.id} initialLiked={likes.mine.has(survey.id)} initialCount={likes.counts.get(survey.id) ?? 0} />
          </div>
        )}
      </section>
      <SurveyForm surveyId={survey.id} questions={questions} initial={myAnswers} open={open} answered={Boolean(response)} />
    </>
  );
}

export default function SurveyPage({ params }: PageProps<"/surveys/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="アンケート" backHref="/surveys" backToPrevious />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10">
        <Suspense fallback={<Loading />}>
          <SurveyContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}
