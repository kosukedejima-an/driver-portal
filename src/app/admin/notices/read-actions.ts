"use server";

// 事故報告書の画像・PDFを読み取り、事故速報の入力欄に入れる下書きを返す（管理者のみ）
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth";
import { READABLE_TYPES, readAccidentReport, readerConfigured, type AccidentDraft, type ReadableType } from "@/lib/accident-reader";

const MAX_BYTES = 9 * 1024 * 1024;

export type ReadResult = { ok: true; draft: AccidentDraft } | { ok: false; message: string };

export async function readAccidentFile(formData: FormData): Promise<ReadResult> {
  await requireAdmin();
  if (!readerConfigured()) {
    return { ok: false, message: "読み取りの準備（AIの鍵 ANTHROPIC_API_KEY の登録）がまだです。" };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "画像かPDFを選んでください。" };
  if (!(READABLE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "画像（JPEG・PNG・WebP）かPDFを選んでください。" };
  }
  if (file.size > MAX_BYTES) return { ok: false, message: "ファイルが大きすぎます（9MBまで）。" };
  try {
    const draft = await readAccidentReport(Buffer.from(await file.arrayBuffer()), file.type as ReadableType);
    return { ok: true, draft };
  } catch (e) {
    // 中身は記録しない。混み合いなどの一時的な失敗だけ見分ける
    if (e instanceof Anthropic.RateLimitError || (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500)) {
      return { ok: false, message: "AIが混み合っています。少し待ってから、もう一度お試しください。" };
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, message: "AIの鍵（ANTHROPIC_API_KEY）が正しくないようです。" };
    }
    return { ok: false, message: "読み取れませんでした。文字がはっきり写った画像か、PDFでお試しください。" };
  }
}
