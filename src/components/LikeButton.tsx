"use client";

import { useState, useTransition } from "react";
import { setLike } from "@/app/likes/actions";
import type { LikeTarget } from "@/lib/timeline";

/** いいねボタン（押すとすぐに数が変わり、うまくいかなければ元に戻す） */
export function LikeButton({ type, id, initialLiked, initialCount }: { type: LikeTarget; id: string; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      const result = await setLike(type, id, next);
      if (!result.ok) {
        setLiked(!next);
        setCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? `いいね済み（${count}）。押すと取り消します` : `いいね（${count}）`}
      className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-base ${
        liked ? "border-primary bg-primary text-white" : "border-gray-300 bg-white text-primary"
      }`}
    >
      <svg className="size-5" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
        <path d="M7 10v11H3V10h4Zm0 0 4-7a2.5 2.5 0 0 1 2.5 2.7L13 10h5.6a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.4 21H7" />
      </svg>
      いいね <span className="font-bold">{count}</span>
    </button>
  );
}
