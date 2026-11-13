// 今日の配車（配車表のPDF）の読み出し（サーバー側だけで使う）
import "server-only";
import { requireProfile } from "./auth";
import { weekDates } from "./dispatch-date";

export const DISPATCH_BUCKET = "dispatch-files";

export type DispatchSheet = {
  id: string;
  sheet_date: string;
  pdf_path: string;
  pdf_name: string | null;
  created_at: string;
  updated_at: string | null;
};

/** カレンダーの1マス（その日の配車表） */
export type DispatchCell = {
  date: string;
  sheet: { id: string; pdfName: string | null; postedAt: string; replaced: boolean } | null;
  /** 開く用の期限付きアドレス */
  url: string | null;
};

/** 今日から1週間分の配車表。データベースの設定がまだ無ければ null */
export async function getDispatchWeek(): Promise<{ dates: string[]; cells: DispatchCell[] } | null> {
  const { supabase } = await requireProfile();
  const dates = weekDates();
  const { data, error } = await supabase.from("dispatch_sheets").select("*").gte("sheet_date", dates[0]).lte("sheet_date", dates[6]);
  if (error) return null;
  const sheets = data as DispatchSheet[];
  const { data: signed } = sheets.length
    ? await supabase.storage.from(DISPATCH_BUCKET).createSignedUrls(sheets.map((s) => s.pdf_path), 60 * 60)
    : { data: [] as { signedUrl: string | null }[] };
  const cells: DispatchCell[] = dates.map((date) => {
    const i = sheets.findIndex((s) => s.sheet_date === date);
    if (i < 0) return { date, sheet: null, url: null };
    const s = sheets[i];
    return {
      date,
      sheet: { id: s.id, pdfName: s.pdf_name, postedAt: s.updated_at ?? s.created_at, replaced: Boolean(s.updated_at) },
      url: signed?.[i]?.signedUrl ?? null,
    };
  });
  return { dates, cells };
}
