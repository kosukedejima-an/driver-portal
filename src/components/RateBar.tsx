import { rate } from "@/lib/format";

/** 確認済みの割合を横棒で表示する */
export function RateBar({ read, total, size = "md" }: { read: number; total: number; size?: "md" | "lg" }) {
  const percent = rate(read, total);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`確認済み ${percent}%`}
      className={`w-full overflow-hidden rounded-full bg-gray-200 ${size === "lg" ? "h-5" : "h-3"}`}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}
