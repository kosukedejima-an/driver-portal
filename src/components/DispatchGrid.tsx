"use client";

import type { DispatchCell } from "@/lib/dispatch";
import { shortSheetDate } from "@/lib/dispatch-date";

/**
 * 配車表のカレンダー（横に今日から1週間の日付、その下に配車表のマス）。
 * 載っているマスは色が付き、押すと配車表（PDF）が開く。
 * onSelect を渡すと（管理者用）、押したマスを選ぶ動きになる。
 */
export function DispatchGrid({
  dates,
  cells,
  onSelect,
  selected,
}: {
  dates: string[];
  cells: DispatchCell[];
  onSelect?: (date: string) => void;
  selected?: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[19rem] table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            {dates.map((d, i) => {
              const { md, w } = shortSheetDate(d);
              const weekend = w === "土" || w === "日";
              return (
                <th key={d} scope="col" className={`rounded-lg py-1 text-center ${i === 0 ? "bg-primary/10" : ""}`}>
                  <span className="block text-sm font-bold">{i === 0 ? "今日" : md}</span>
                  <span className={`block text-sm ${weekend ? "text-gold" : "text-gray-600"}`}>{i === 0 ? md : `（${w}）`}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            {dates.map((d) => {
              const c = cells.find((x) => x.date === d);
              const has = Boolean(c?.sheet);
              const isSelected = selected === d;
              const base = "flex min-h-16 w-full items-center justify-center rounded-lg text-sm font-bold";
              const look = has ? "bg-primary text-white" : "border border-dashed border-gray-300 bg-white text-gray-400";
              const ring = isSelected ? " ring-4 ring-gold-line ring-offset-1" : "";
              const a11y = `${shortSheetDate(d).md}の配車表：${has ? "あり" : "まだ"}`;
              const label = has ? "開く" : "なし";
              return (
                <td key={d} className="p-0">
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(d)} aria-pressed={isSelected} aria-label={a11y} className={`${base} ${look}${ring}`}>
                      {has ? "あり" : "なし"}
                    </button>
                  ) : has && c?.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`${a11y}（押すと開きます）`} className={`${base} ${look}`}>
                      {label}
                    </a>
                  ) : (
                    <span aria-label={a11y} className={`${base} ${look}`}>
                      {label}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
