/** 日時 → "2026年10月7日（水）"（日本時間） */
export function formatDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日（${get("weekday")}）`;
}

/** 日時 → "2026年10月7日（水）14:05"（日本時間） */
export function formatDateTime(iso: string): string {
  const time = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return `${formatDate(iso)}${time}`;
}

export function rate(read: number, total: number): number {
  return total === 0 ? 0 : Math.round((read / total) * 100);
}
