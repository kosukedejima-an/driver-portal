import { Suspense } from "react";
import { DriverShell } from "@/components/DriverShell";
import { Loading } from "@/components/Loading";
import { NoticeList } from "@/components/NoticeList";
import { getNoticeSummaries } from "@/lib/queries";

async function NoticesContent() {
  return <NoticeList notices={await getNoticeSummaries()} />;
}

export default function NoticesPage() {
  return (
    <DriverShell title="お知らせ一覧">
      <Suspense fallback={<Loading />}>
        <NoticesContent />
      </Suspense>
    </DriverShell>
  );
}
