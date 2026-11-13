import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { LikeButton } from "@/components/LikeButton";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/format";
import { getNoticeDetail } from "@/lib/queries";
import { getLikes } from "@/lib/timeline";
import { CATEGORY_SLUGS } from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function NoticeDetail({ params }: { params: PageProps<"/notices/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const [detail, likes] = await Promise.all([getNoticeDetail(id), getLikes("notice", [id])]);
  if (!detail) notFound();
  const { notice, readAt, photoUrl } = detail;
  const listHref = `/categories/${CATEGORY_SLUGS[notice.category]}`;

  return (
    <>
      <PageHeader title="お知らせ詳細" backHref="/notices" backToPrevious />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-40">
      <article className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={notice.category} />
          <span className="text-sm text-gray-600">{formatDate(notice.published_at)}</span>
          {notice.is_dummy && <DummyBadge />}
        </div>
        <p className="mt-2 text-sm text-gray-600">投稿者：{notice.author_label}</p>
        <h2 className="mt-3 text-xl font-bold leading-snug">{notice.title}</h2>

        {photoUrl && (
          <figure className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- 期限付きURLの写真のため通常の img を使う */}
            <img src={photoUrl} alt={notice.photo_caption ?? "お知らせの写真"} className="w-full rounded-lg" />
            {notice.photo_caption && (
              <figcaption className="mt-1 text-sm text-gray-600">{notice.photo_caption}</figcaption>
            )}
          </figure>
        )}

        {notice.category === "事故速報" ? (
          <dl className="mt-4 flex flex-col gap-4">
            {(
              [
                ["発生状況", notice.accident_situation],
                ["原因", notice.accident_cause],
                ["再発防止", notice.accident_prevention],
              ] as const
            ).map(([label, text]) => (
              <div key={label}>
                <dt className="border-l-4 border-primary pl-2 text-base font-bold">{label}</dt>
                <dd className="mt-1 text-base leading-relaxed whitespace-pre-wrap">{text}</dd>
              </div>
            ))}
            {notice.body && (
              <div>
                <dt className="border-l-4 border-primary pl-2 text-base font-bold">補足</dt>
                <dd className="mt-1 text-base leading-relaxed whitespace-pre-wrap">{notice.body}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap">{notice.body}</p>
        )}
      </article>
      {likes.enabled && (
        <div className="mt-3 flex justify-end">
          <LikeButton type="notice" id={notice.id} initialLiked={likes.mine.has(notice.id)} initialCount={likes.counts.get(notice.id) ?? 0} />
        </div>
      )}
      {notice.hidden_at ? (
        <p className="mt-4 rounded-lg bg-gray-100 p-3 text-base">
          このお知らせは非表示中のため、ドライバーには表示されていません。
        </p>
      ) : (
        <ConfirmButton noticeId={notice.id} confirmed={readAt !== null} backHref={listHref} />
      )}
      </main>
    </>
  );
}

export default function NoticeDetailPage({ params }: PageProps<"/notices/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <>
            <PageHeader title="お知らせ詳細" backHref="/notices" backToPrevious />
            <Loading />
          </>
        }
      >
        <NoticeDetail params={params} />
      </Suspense>
    </div>
  );
}
