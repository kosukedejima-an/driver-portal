import Link from "next/link";
import { Suspense } from "react";
import { DriverShell } from "@/components/DriverShell";
import { HomeActions } from "@/components/HomeActions";
import { HomeMenu, type MenuItem } from "@/components/HomeMenu";
import { Loading } from "@/components/Loading";
import { PushPrompt } from "@/components/PushPrompt";
import { TimelineCard } from "@/components/TimelineCard";
import { getLibrary, unseenCount } from "@/lib/library";
import { getNoticeSummaries } from "@/lib/queries";
import { getSurveySummaries, unansweredCount } from "@/lib/surveys";
import { getTimeline } from "@/lib/timeline";

const PAGE = 20;

async function HomeContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { n } = await searchParams;
  const limit = Math.min(200, Math.max(PAGE, Number(typeof n === "string" ? n : PAGE) || PAGE));
  const [notices, library, surveys, timeline] = await Promise.all([
    getNoticeSummaries(),
    getLibrary(),
    getSurveySummaries(),
    getTimeline(limit),
  ]);
  const unread = notices.filter((x) => !x.isRead).length;

  const menu: MenuItem[] = [
    // 今日の配車は一番左（supabase/setup.sql 実行前でも出す。画面の中で「まだ使えません」と案内する）
    { href: "/dispatch", label: "今日の配車", icon: "dispatch", count: 0, countLabel: "" },
    { href: "/notices", label: "お知らせ", icon: "notice", count: unread, countLabel: "未読" },
  ];
  // 情報集（supabase/setup.sql）・アンケート（supabase/setup.sql）は、仕組みが使えるときだけ出す
  if (library) menu.push({ href: "/library", label: "情報集", icon: "library", count: unseenCount(library.items), countLabel: "新着・更新・未確認" });
  if (surveys) menu.push({ href: "/surveys", label: "アンケート", icon: "survey", count: unansweredCount(surveys), countLabel: "未回答" });

  return (
    <>
      <HomeMenu items={menu} />
      <h2 className="mt-4 mb-3 text-base font-bold text-gray-700">タイムライン</h2>
      {timeline.items.length === 0 ? (
        <p className="py-10 text-center text-base text-gray-600">まだ投稿はありません。</p>
      ) : (
        <div className="flex flex-col gap-4">
          {timeline.items.map((item) => (
            <TimelineCard key={`${item.type}-${item.id}`} item={item} likesEnabled={timeline.likesEnabled} />
          ))}
        </div>
      )}
      {timeline.hasMore && (
        <Link
          href={`/?n=${limit + PAGE}`}
          scroll={false}
          className="mt-4 flex min-h-12 items-center justify-center rounded-lg border border-gray-300 bg-white text-base text-primary"
        >
          もっと見る
        </Link>
      )}
      <PushPrompt unread={unread} />
    </>
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <DriverShell title="ホーム" brand={false} backHref={null} actions={<HomeActions />}>
      <Suspense fallback={<Loading />}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </DriverShell>
  );
}
