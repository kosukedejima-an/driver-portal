"use client";

import { useState } from "react";
import { CATEGORIES, type Category, type NoticeSummary } from "@/lib/types";
import { NoticeCard } from "./NoticeCard";

type Filter = "すべて" | Category;
const FILTERS: Filter[] = ["すべて", ...CATEGORIES];

export function NoticeList({
  notices,
  showFilter = true,
}: {
  notices: NoticeSummary[];
  showFilter?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("すべて");
  const shown = filter === "すべて" ? notices : notices.filter((n) => n.category === filter);

  return (
    <div>
      {showFilter && (
        <div
          role="tablist"
          aria-label="カテゴリで絞り込み"
          className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${
                filter === f
                  ? "border-primary bg-primary text-white"
                  : "border-gray-300 bg-white text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-8 text-center text-base text-gray-600">お知らせはありません</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((n) => (
            <li key={n.id}>
              <NoticeCard notice={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
