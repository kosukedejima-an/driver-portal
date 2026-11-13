// 事故報告書（画像・PDF）を AI（Claude）で読み取り、事故速報の下書きを作る（サーバー側だけで使う）
// 鍵は環境変数 ANTHROPIC_API_KEY から読む。読み取った中身や画像は記録（console.log など）に残さない。
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const READABLE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
export type ReadableType = (typeof READABLE_TYPES)[number];

const DraftSchema = z.object({
  title: z.string().describe("お知らせのタイトル。何が起きたかを30字以内で。「【事故速報】」は付けない"),
  situation: z.string().describe("発生状況：いつ・どこで・何が起きたか"),
  cause: z.string().describe("原因"),
  prevention: z.string().describe("再発防止：ドライバーに守ってほしいこと"),
  notes: z.string().describe("読み取れなかった箇所や、管理者に確かめてほしい点。なければ空文字"),
});
export type AccidentDraft = z.infer<typeof DraftSchema>;

const SYSTEM = `あなたは運送会社の本社の安全担当です。
社内で決まった書式の「事故報告書」の画像またはPDFを読み、全ドライバーに配る「事故速報」の下書きを作ります。

- 報告書に書かれていることだけを使い、書かれていないことを付け足さない。読み取れない・書かれていない項目は空文字にする
- ドライバー全員が読むので、分かりやすい日本語で、短く書く
- 個人を特定できる情報（氏名、車両番号、電話番号、住所、相手方の情報）は書かず、「運転者」「当該車両」「相手車両」などに置き換える
- 日時と場所は、報告書にあればそのまま書く（場所は「〇〇付近」程度でよい）
- 再発防止は、ドライバーが明日から実行できる行動として書く。報告書の対策欄が空なら空文字にする
- 字がかすれている・手書きで読みにくいなど、自信のない箇所は notes に書く`;

let client: Anthropic | null = null;

export function readerConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** 報告書（画像・PDF）を読み取り、下書きを返す。読み取れなければ例外 */
export async function readAccidentReport(data: Buffer, mediaType: ReadableType): Promise<AccidentDraft> {
  client ??= new Anthropic();
  const base64 = data.toString("base64");
  const file: Anthropic.Beta.BetaContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // 断られたときは、同じ依頼を別のモデルで自動でやり直す
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(DraftSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: [file, { type: "text", text: "この事故報告書から、事故速報の下書きを作ってください。" }] }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("unreadable");
  }
  return response.parsed_output;
}
