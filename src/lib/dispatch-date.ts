// 配車表の日付（日本の日付 "YYYY-MM-DD"）の計算。画面側・サーバー側のどちらでも使う

/** 今日から days 日後の日本の日付（"YYYY-MM-DD"） */
export function jstDate(days = 0, now = new Date()): string {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d); // sv-SE は "YYYY-MM-DD" の形
}

/** 今日から1週間分の日付 */
export function weekDates(now = new Date()): string[] {
  return Array.from({ length: 7 }, (_, i) => jstDate(i, now));
}

function weekday(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short" }).format(new Date(`${date}T12:00:00+09:00`));
}

/** "YYYY-MM-DD" → "11月10日（火）" */
export function formatSheetDate(date: string): string {
  const [, m, day] = date.split("-").map(Number);
  return `${m}月${day}日（${weekday(date)}）`;
}

/** カレンダーの見出し用："11/10" と "火" */
export function shortSheetDate(date: string): { md: string; w: string } {
  const [, m, day] = date.split("-").map(Number);
  return { md: `${m}/${day}`, w: weekday(date) };
}

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
