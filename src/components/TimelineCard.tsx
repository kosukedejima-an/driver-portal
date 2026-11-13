import Link from "next/link";
import { formatDate } from "@/lib/format";
import { instagramPermalink } from "@/lib/instagram";
import type { TimelineItem } from "@/lib/timeline";
import { CategoryBadge } from "./CategoryBadge";
import { DummyBadge } from "./DummyBadge";
import { InstagramEmbed } from "./InstagramEmbed";
import { LikeButton } from "./LikeButton";

/** タイムラインの1件（お知らせ・アンケート）。未確認・未回答は赤の枠と表示で目立たせる */
export function TimelineCard({ item, likesEnabled }: { item: TimelineItem; likesEnabled: boolean }) {
  if (item.instagram) return <InstagramCard item={item} likesEnabled={likesEnabled} />;
  const href = item.type === "notice" ? `/notices/${item.id}` : `/surveys/${item.id}`;
  return (
    <article className={`overflow-hidden rounded-xl bg-white ${item.todo ? "border-2 border-unread" : "border border-gray-200"}`}>
      <Link href={href} className="block p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.type === "notice" && item.label !== "アンケート" && item.label !== "Instagram" ? (
            <CategoryBadge category={item.label} />
          ) : (
            <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">アンケート</span>
          )}
          <span className={item.todo ? "text-sm font-bold text-unread" : "text-sm text-gray-500"}>
            {item.todo ? `● ${item.statusText}` : item.statusText}
          </span>
          {item.isDummy && <DummyBadge />}
        </div>
        <h2 className="mt-2 text-lg font-bold leading-snug">{item.title}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {formatDate(item.date)}
          {item.author && `・${item.author}`}
        </p>
        {item.excerpt && <p className="mt-2 text-base leading-relaxed text-gray-800">{item.excerpt}</p>}
        {item.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- 期限付きURLの写真のため通常の img を使う
          <img src={item.photoUrl} alt="" loading="lazy" className="mt-3 aspect-video w-full rounded-lg object-cover" />
        )}
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2">
        {likesEnabled ? <LikeButton type={item.type} id={item.id} initialLiked={item.liked} initialCount={item.likes} /> : <span />}
        <Link href={href} className="flex min-h-11 items-center px-2 text-base text-primary">
          {item.type === "survey" && item.todo ? "回答する ›" : "詳しく見る ›"}
        </Link>
      </div>
    </article>
  );
}

/** タイムラインの Instagram の投稿（通知・既読確認はなし。いいねだけ） */
function InstagramCard({ item, likesEnabled }: { item: TimelineItem; likesEnabled: boolean }) {
  const ig = item.instagram!;
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">Instagram</span>
          <span className="text-sm text-gray-600">{formatDate(item.date)}</span>
          {item.isDummy && <DummyBadge />}
        </div>
        {item.excerpt && <p className="mt-2 text-base leading-relaxed whitespace-pre-wrap text-gray-800">{item.excerpt}</p>}
      </div>
      <InstagramEmbed kind={ig.kind} shortcode={ig.shortcode} />
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2">
        {likesEnabled ? <LikeButton type="instagram" id={item.id} initialLiked={item.liked} initialCount={item.likes} /> : <span />}
        <a
          href={instagramPermalink(ig.kind, ig.shortcode)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center px-2 text-base text-primary"
        >
          Instagramで開く ›
        </a>
      </div>
    </article>
  );
}
