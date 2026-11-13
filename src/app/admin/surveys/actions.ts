"use server";

// アンケートの作成・変更・非表示・完全削除（管理者のみ。権限はデータベース側でも確認している）
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notifyNewSurvey } from "@/lib/push";
import { getSiteUrl } from "@/lib/site-url";

export type SurveyActionResult = { ok: boolean; message: string | null };

export type NewQuestion = { kind: "single" | "multi" | "text"; text: string; options: string[]; required: boolean };
export type NewSurvey = { title: string; description: string; anonymous: boolean; deadline: string; questions: NewQuestion[] };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEED_SETUP = "データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。";

/** 入力欄の「2026-11-10T17:00」を日本時間として読み取る。空なら締め切りなし */
function parseDeadline(v: string): { iso: string | null } | { error: string } {
  const s = v.trim();
  if (!s) return { iso: null };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return { error: "締め切りの日時が正しくありません。" };
  const d = new Date(`${s}:00+09:00`);
  if (Number.isNaN(d.getTime())) return { error: "締め切りの日時が正しくありません。" };
  return { iso: d.toISOString() };
}

/** アンケートを作って公開する。公開と同時に社員のスマホへ通知する */
export async function createSurvey(input: NewSurvey): Promise<SurveyActionResult> {
  const { supabase, profile } = await requireAdmin();
  const title = input.title.trim().slice(0, 100);
  if (!title) return { ok: false, message: "題名を入力してください。" };
  const deadline = parseDeadline(input.deadline);
  if ("error" in deadline) return { ok: false, message: deadline.error };
  if (deadline.iso && new Date(deadline.iso).getTime() <= Date.now()) {
    return { ok: false, message: "締め切りは、今より後の日時にしてください。" };
  }
  if (!Array.isArray(input.questions) || input.questions.length === 0) return { ok: false, message: "質問を1つ以上作ってください。" };
  if (input.questions.length > 30) return { ok: false, message: "質問は30個までです。" };

  const questions: NewQuestion[] = [];
  for (const [i, q] of input.questions.entries()) {
    const text = String(q.text ?? "").trim().slice(0, 300);
    if (!text) return { ok: false, message: `質問${i + 1}の文を入力してください。` };
    if (!["single", "multi", "text"].includes(q.kind)) return { ok: false, message: `質問${i + 1}の形式を選んでください。` };
    const options = q.kind === "text" ? [] : (q.options ?? []).map((o) => String(o).trim().slice(0, 100)).filter(Boolean);
    if (q.kind !== "text" && options.length < 2) return { ok: false, message: `質問${i + 1}の選択肢を2つ以上入力してください。` };
    if (options.length > 20) return { ok: false, message: `質問${i + 1}の選択肢は20個までです。` };
    questions.push({ kind: q.kind, text, options, required: Boolean(q.required) });
  }

  const { data: survey, error } = await supabase
    .from("surveys")
    .insert({
      title,
      description: input.description.trim().slice(0, 2000) || null,
      anonymous: Boolean(input.anonymous),
      deadline: deadline.iso,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.code === "42P01" ? NEED_SETUP : "保存できませんでした。もう一度お試しください。" };

  const { error: qError } = await supabase
    .from("survey_questions")
    .insert(questions.map((q, i) => ({ survey_id: survey.id, position: i, ...q })));
  if (qError) {
    await supabase.from("surveys").update({ hidden_at: new Date().toISOString() }).eq("id", survey.id);
    await supabase.from("surveys").delete().eq("id", survey.id);
    return { ok: false, message: "質問を保存できませんでした。もう一度お試しください。" };
  }

  const siteUrl = await getSiteUrl();
  after(() => notifyNewSurvey(survey.id, siteUrl));
  redirect(`/admin/surveys/${survey.id}?done=created`);
}

/** 題名・説明・締め切りを直す（質問は、回答の集計が崩れないよう作成後は変えない） */
export async function updateSurveySettings(_prev: SurveyActionResult, formData: FormData): Promise<SurveyActionResult> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "アンケートが見つかりません。" };
  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  if (!title) return { ok: false, message: "題名を入力してください。" };
  const deadline = parseDeadline(String(formData.get("deadline") ?? ""));
  if ("error" in deadline) return { ok: false, message: deadline.error };
  const { data, error } = await supabase
    .from("surveys")
    .update({
      title,
      description: String(formData.get("description") ?? "").trim().slice(0, 2000) || null,
      deadline: deadline.iso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "保存できませんでした。もう一度お試しください。" };
  refresh();
  return { ok: true, message: "保存しました。" };
}

/** 非表示にする・再表示する */
export async function setSurveyHidden(id: string, hidden: boolean): Promise<SurveyActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "アンケートが見つかりません。" };
  const { data, error } = await supabase
    .from("surveys")
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "変更できませんでした。もう一度お試しください。" };
  refresh();
  return { ok: true, message: hidden ? "非表示にしました。ドライバーの画面には出ません。" : "再表示しました。" };
}

/** 完全に削除する（非表示にしたものだけ。回答もすべて消える） */
export async function deleteSurvey(id: string): Promise<SurveyActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "アンケートが見つかりません。" };
  const { data, error } = await supabase.from("surveys").delete().eq("id", id).select("id");
  if (error || !data?.length) {
    return { ok: false, message: "削除できませんでした。完全に削除できるのは、非表示にしたアンケートだけです。" };
  }
  redirect("/admin/surveys?done=deleted");
}
