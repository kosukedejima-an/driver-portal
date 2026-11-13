// テスト用のダミーのアンケート（内容はすべて架空）。「ダミーデータを入れる／消す」で一緒に出し入れする。
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type DummyQuestion = { kind: "single" | "multi" | "text"; text: string; options?: string[]; required?: boolean };
type DummySurvey = {
  title: string;
  description: string;
  anonymous: boolean;
  /** 締め切り（今から何日後か。マイナスは締め切り済み） */
  deadlineDays: number;
  /** 何日前に公開したことにするか */
  publishedDaysAgo: number;
  /** 回答する人の割合の目安 */
  answerRate: number;
  questions: DummyQuestion[];
  /** 自由記述の回答の見本（架空） */
  sampleTexts?: string[];
};

const DUMMY_SURVEYS: DummySurvey[] = [
  {
    title: "年末年始の勤務希望調査",
    description: "年末年始の配車を組むため、勤務できる日を教えてください。（ダミーのアンケートです）",
    anonymous: false,
    deadlineDays: 5,
    publishedDaysAgo: 2,
    answerRate: 0.6,
    questions: [
      { kind: "single", text: "12月31日の夜の運行に入れますか？", options: ["入れる", "入れない", "まだ分からない"] },
      { kind: "multi", text: "1月1日〜3日のうち、出勤できる日をすべて選んでください", options: ["1月1日", "1月2日", "1月3日"], required: false },
      { kind: "text", text: "勤務についての要望があれば書いてください", required: false },
    ],
    sampleTexts: ["31日は家族の用事があるため、できれば日中の便を希望します。", "2日の朝便なら入れます。"],
  },
  {
    title: "職場環境についての意識調査",
    description: "職場をよくするための調査です。無記名なので、だれが答えたかは管理者にも分かりません。（ダミーのアンケートです）",
    anonymous: true,
    deadlineDays: 10,
    publishedDaysAgo: 4,
    answerRate: 0.45,
    questions: [
      { kind: "single", text: "今の職場に満足していますか？", options: ["満足", "やや満足", "ふつう", "やや不満", "不満"] },
      {
        kind: "multi",
        text: "改善してほしいところを選んでください（いくつでも）",
        options: ["休憩所", "車両の設備", "勤務シフト", "本社との連絡方法", "その他"],
        required: false,
      },
      { kind: "text", text: "自由な意見があれば書いてください", required: false },
    ],
    sampleTexts: ["物流センターの待機場所に屋根がほしいです。", "シフトの連絡をもう少し早くしてほしい。", "特にありません。"],
  },
  {
    title: "安全運転講習会の出欠",
    description: "先月の安全運転講習会の出欠確認です。（ダミーのアンケートです。締め切り済み）",
    anonymous: false,
    deadlineDays: -2,
    publishedDaysAgo: 12,
    answerRate: 0.9,
    questions: [{ kind: "single", text: "講習会に出席しますか？", options: ["出席", "欠席"] }],
  },
  {
    title: "冬用の防寒着のサイズ確認",
    description: "冬用の防寒着を配るため、サイズを教えてください。（ダミーのアンケートです）",
    anonymous: false,
    deadlineDays: 7,
    publishedDaysAgo: 1,
    answerRate: 0.35,
    questions: [
      { kind: "single", text: "防寒着のサイズを選んでください", options: ["M", "L", "LL", "3L"] },
      { kind: "single", text: "手袋も必要ですか？", options: ["必要", "不要"] },
    ],
  },
  {
    title: "社内報で読みたい記事",
    description: "これからの社内報の参考にします。無記名です。（ダミーのアンケートです）",
    anonymous: true,
    deadlineDays: 14,
    publishedDaysAgo: 6,
    answerRate: 0.5,
    questions: [
      {
        kind: "multi",
        text: "読みたい記事を選んでください（いくつでも）",
        options: ["ほかの営業所の紹介", "事故防止のコツ", "社員インタビュー", "会社のこれから"],
      },
      { kind: "text", text: "ほかに読みたい記事があれば書いてください", required: false },
    ],
    sampleTexts: ["ベテランドライバーの雪道の走り方を知りたいです。", "各営業所のおすすめの休憩場所。"],
  },
];

/** 毎回同じ並びになる乱数 */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function clearDummySurveys(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.from("surveys").delete().eq("is_dummy", true).select("id");
  return error ? 0 : data.length; // supabase/setup.sql 実行前は何もしない
}

/** ダミーのアンケートと回答を入れる。アンケートの仕組みがまだ無ければ何もしない */
export async function seedDummySurveys(admin: SupabaseClient, driverIds: string[]): Promise<number> {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const random = seededRandom(1101);
  let count = 0;

  for (const s of DUMMY_SURVEYS) {
    const { data: survey, error } = await admin
      .from("surveys")
      .insert({
        title: s.title,
        description: s.description,
        anonymous: s.anonymous,
        deadline: new Date(now + s.deadlineDays * day).toISOString(),
        published_at: new Date(now - s.publishedDaysAgo * day).toISOString(),
        push_sent_at: new Date().toISOString(), // ダミーは通知しない
        is_dummy: true,
      })
      .select("id")
      .single();
    if (error) return count; // supabase/setup.sql 実行前
    count++;

    const { data: questions, error: qError } = await admin
      .from("survey_questions")
      .insert(s.questions.map((q, i) => ({ survey_id: survey.id, position: i, kind: q.kind, text: q.text, options: q.options ?? [], required: q.required ?? true })))
      .select("id, kind, options, required, position")
      .order("position");
    if (qError) throw qError;

    // 社員ごとに回答するかどうかを決め、回答の中身も適当にばらつかせる
    for (const [j, userId] of driverIds.entries()) {
      const tendency = driverIds.length > 1 ? j / (driverIds.length - 1) : 0;
      if (0.5 * random() + 0.5 * tendency >= s.answerRate) continue;
      const { data: resp, error: rError } = await admin
        .from("survey_responses")
        .insert({ survey_id: survey.id, user_id: userId, submitted_at: new Date(now - random() * s.publishedDaysAgo * day).toISOString() })
        .select("id")
        .single();
      if (rError) throw rError;
      type AnswerRow = { response_id: string; question_id: string; text_value?: string; choice_indexes?: number[] };
      const answers = (questions as { id: string; kind: string; options: string[]; required: boolean }[]).flatMap((q): AnswerRow[] => {
        if (q.kind === "text") {
          if (!s.sampleTexts || random() > 0.4) return [];
          return [{ response_id: resp.id, question_id: q.id, text_value: s.sampleTexts[Math.floor(random() * s.sampleTexts.length)] }];
        }
        if (q.kind === "single") {
          // 前の方の選択肢ほど選ばれやすくする
          const k = Math.min(q.options.length - 1, Math.floor(random() * random() * q.options.length * 1.6));
          return [{ response_id: resp.id, question_id: q.id, choice_indexes: [k] }];
        }
        const picks = q.options.map((_, k) => k).filter(() => random() < 0.35);
        if (picks.length === 0 && !q.required) return [];
        return [{ response_id: resp.id, question_id: q.id, choice_indexes: picks.length ? picks : [0] }];
      });
      if (answers.length) {
        const { error: aError } = await admin.from("survey_answers").insert(answers);
        if (aError) throw aError;
      }
    }
  }
  return count;
}

/** ダミーのお知らせ・アンケートに、ダミー社員の「いいね」を付ける。いいねの仕組みがまだ無ければ何もしない */
export async function seedDummyLikes(admin: SupabaseClient, driverIds: string[]): Promise<number> {
  const random = seededRandom(2024);
  const [notices, surveys] = await Promise.all([
    admin.from("notices").select("id").eq("is_dummy", true),
    admin.from("surveys").select("id").eq("is_dummy", true),
  ]);
  const targets = [
    ...(notices.data ?? []).map((n) => ({ target_type: "notice", target_id: n.id as string })),
    ...(surveys.data ?? []).map((s) => ({ target_type: "survey", target_id: s.id as string })),
  ];
  const rows = targets.flatMap((t) => {
    const rate = 0.1 + random() * 0.4; // 投稿ごとに 10〜50% の人がいいね
    return driverIds.filter(() => random() < rate).map((user_id) => ({ ...t, user_id }));
  });
  if (rows.length === 0) return 0;
  const { error } = await admin.from("post_likes").insert(rows);
  return error ? 0 : rows.length; // supabase/setup.sql 実行前は 0
}
