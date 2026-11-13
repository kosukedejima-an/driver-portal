import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { getDispatchWeek } from "@/lib/dispatch";
import { requireAdmin } from "@/lib/auth";
import { DispatchBoard } from "./DispatchBoard";

async function Board() {
  await requireAdmin();
  const week = await getDispatchWeek();
  if (!week) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。
      </p>
    );
  }
  return <DispatchBoard dates={week.dates} cells={week.cells} />;
}

export default function AdminDispatchPage() {
  return (
    <AdminShell current="/admin/dispatch">
      <p className="text-base text-gray-700">
        ドライバーの「今日の配車」には、今日から1週間分の配車表が、このカレンダーと同じ形で出ます。
      </p>
      <Suspense fallback={<Loading />}>
        <Board />
      </Suspense>
    </AdminShell>
  );
}
