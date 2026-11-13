import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { NoticeList } from "@/components/NoticeList";
import { PageHeader } from "@/components/PageHeader";
import { getNoticeSummaries } from "@/lib/queries";
import { CATEGORIES, CATEGORY_SLUGS, categoryFromSlug } from "@/lib/types";

type Params = PageProps<"/categories/[slug]">["params"];

// カテゴリは4つだけなので、画面のアドレスを前もって決めておく
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: CATEGORY_SLUGS[c] }));
}

/** カテゴリ別のお知らせ一覧（未読が上） */
async function CategoryContent({ params }: { params: Params }) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();
  const notices = await getNoticeSummaries(category);
  const unread = notices.filter((n) => !n.isRead).length;
  return (
    <>
      <PageHeader title={category} backHref="/" backLabel="ホーム" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10">
        {unread > 0 && (
          <p className="mb-3 text-base font-bold text-unread">未読 {unread}件</p>
        )}
        <NoticeList notices={notices} showFilter={false} />
      </main>
    </>
  );
}

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <>
            <PageHeader title="お知らせ" backHref="/" backLabel="ホーム" />
            <Loading />
          </>
        }
      >
        <CategoryContent params={params} />
      </Suspense>
    </div>
  );
}
