import { Suspense } from "react";
import { DispatchGrid } from "@/components/DispatchGrid";
import { DriverShell } from "@/components/DriverShell";
import { Loading } from "@/components/Loading";
import { getDispatchWeek } from "@/lib/dispatch";

async function DispatchCalendar() {
  const week = await getDispatchWeek();
  if (!week) return <p className="py-8 text-center text-base text-gray-600">今日の配車はまだ使えません。</p>;
  const count = week.cells.filter((c) => c.sheet).length;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-2">
      <DispatchGrid dates={week.dates} cells={week.cells} />
      <p className="mt-2 px-2 pb-1 text-sm text-gray-600">
        {count > 0 ? "色の付いた「開く」を押すと、その日の配車表が開きます。" : "この1週間の配車表は、まだ載っていません。"}
      </p>
    </section>
  );
}

export default function DispatchPage() {
  return (
    <DriverShell title="今日の配車">
      <Suspense fallback={<Loading />}>
        <DispatchCalendar />
      </Suspense>
    </DriverShell>
  );
}
