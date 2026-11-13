import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { readerConfigured } from "@/lib/accident-reader";
import { requireAdmin } from "@/lib/auth";
import { NoticeForm } from "../NoticeForm";

async function PostFormForAdmin() {
  await requireAdmin();
  // AIの鍵（ANTHROPIC_API_KEY）が登録されているときだけ「事故報告書から読み取る」を出す
  return <NoticeForm canReadReport={readerConfigured()} />;
}

export default function NewNoticePage() {
  return (
    <AdminShell current="/admin/notices/new" width="narrow">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-lg font-bold">お知らせを投稿する</h2>
        <Suspense fallback={<Loading />}>
          <PostFormForAdmin />
        </Suspense>
      </section>
    </AdminShell>
  );
}
