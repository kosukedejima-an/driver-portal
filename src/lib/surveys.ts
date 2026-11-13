// アンケートの読み出し（サーバー側だけで使う）
import "server-only";
import { cache } from "react";
import { requireProfile } from "./auth";

export type Survey = {
  id: string;
  title: string;
  description: string | null;
  anonymous: boolean;
  deadline: string | null;
  published_at: string;
  hidden_at: string | null;
  is_dummy?: boolean;
};

export type SurveyQuestion = {
  id: string;
  survey_id: string;
  position: number;
  kind: "single" | "multi" | "text";
  text: string;
  options: string[];
  required: boolean;
};

export type SurveySummary = Survey & { answered: boolean; open: boolean };

export function isOpen(s: Pick<Survey, "deadline">, now = Date.now()): boolean {
  return !s.deadline || new Date(s.deadline).getTime() > now;
}

/**
 * ドライバー向けのアンケート一覧（自分が回答済みかどうか付き）。
 * 並び順：受付中で未回答 → 受付中で回答済み → 締め切り済み。
 * アンケートの仕組み（supabase/setup.sql）がまだ無いときは null を返す。
 */
export const getSurveySummaries = cache(async function getSurveySummaries(): Promise<SurveySummary[] | null> {
  const { supabase, profile } = await requireProfile();
  const [surveysRes, mineRes] = await Promise.all([
    supabase.from("surveys").select("*").is("hidden_at", null).order("published_at", { ascending: false }),
    supabase.from("survey_responses").select("survey_id").eq("user_id", profile.id),
  ]);
  if (surveysRes.error || mineRes.error) return null;
  const mine = new Set(mineRes.data.map((r) => r.survey_id as string));
  const now = Date.now();
  const rank = (s: SurveySummary) => (s.open ? (s.answered ? 1 : 0) : 2);
  return (surveysRes.data as Survey[])
    .filter((s) => new Date(s.published_at).getTime() <= now)
    .map((s) => ({ ...s, answered: mine.has(s.id), open: isOpen(s, now) }))
    .sort((a, b) => rank(a) - rank(b));
});

/** 受付中で、まだ答えていないアンケートの数（ホームのBOX用） */
export function unansweredCount(list: SurveySummary[]): number {
  return list.filter((s) => s.open && !s.answered).length;
}

/** アンケート1件と質問、自分の回答 */
export async function getSurveyForAnswer(id: string) {
  const { supabase, profile } = await requireProfile();
  const { data: survey } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle<Survey>();
  if (!survey || survey.hidden_at) return null;
  const [qRes, respRes] = await Promise.all([
    supabase.from("survey_questions").select("*").eq("survey_id", id).order("position"),
    supabase.from("survey_responses").select("id, submitted_at, updated_at").eq("survey_id", id).eq("user_id", profile.id).maybeSingle<{
      id: string;
      submitted_at: string;
      updated_at: string | null;
    }>(),
  ]);
  const myAnswers: Record<string, { choices?: number[]; text?: string }> = {};
  if (respRes.data) {
    const { data: answers } = await supabase
      .from("survey_answers")
      .select("question_id, choice_indexes, text_value")
      .eq("response_id", respRes.data.id);
    for (const a of answers ?? []) {
      myAnswers[a.question_id as string] = { choices: (a.choice_indexes as number[] | null) ?? undefined, text: (a.text_value as string | null) ?? undefined };
    }
  }
  return {
    survey,
    questions: (qRes.data ?? []) as SurveyQuestion[],
    response: respRes.data,
    myAnswers,
    open: isOpen(survey),
  };
}
