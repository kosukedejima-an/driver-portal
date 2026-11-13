"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";

export type AnswerResult = { ok: boolean; message: string };

const MESSAGES: Record<string, string> = {
  required: "答えていない質問があります。「必須」の質問にはすべて答えてください。",
  closed: "締め切りを過ぎたため、回答できません。",
  not_found: "このアンケートは見つかりません。",
  bad_choice: "選び方が正しくありません。もう一度選び直してください。",
  not_member: "回答できません。管理者に連絡してください。",
};

/** アンケートに回答する（締め切りまでは何度でも直せる） */
export async function answerSurvey(
  surveyId: string,
  answers: Record<string, { choices?: number[]; text?: string }>,
): Promise<AnswerResult> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("submit_survey_response", { p_survey: surveyId, p_answers: answers });
  if (error) return { ok: false, message: MESSAGES[error.hint ?? ""] ?? "送れませんでした。通信状態を確認して、もう一度お試しください。" };
  refresh();
  return { ok: true, message: "回答しました。ご協力ありがとうございます。締め切りまでは回答を直せます。" };
}
