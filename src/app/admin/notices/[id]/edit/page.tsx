import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import type { Notice } from "@/lib/types";
import { readerConfigured } from "@/lib/accident-reader";
import { NoticeForm } from "../../NoticeForm";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditForm({ params }: { params: PageProps<"/admin/notices/[id]/edit">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data: notice } = await supabase.from("notices").select("*").eq("id", id).maybeSingle<Notice>();
  if (!notice) notFound();
  const photo = notice.photo_path
    ? await supabase.storage.from("notice-photos").createSignedUrl(notice.photo_path, 60 * 60)
    : null;

  return (
    <>
      {notice.hidden_at && (
        <p className="mb-4 rounded-lg bg-gray-100 p-3 text-base">
          このお知らせは非表示中です。保存しても非表示のままです。
        </p>
      )}
      <NoticeForm notice={notice} photoUrl={photo?.data?.signedUrl ?? null} canReadReport={readerConfigured()} />
    </>
  );
}

export default function EditNoticePage({ params }: PageProps<"/admin/notices/[id]/edit">) {
  return (
    <AdminShell current="/admin/reads" width="narrow">
      <Suspense fallback={null}>
        <BackLink params={params} />
      </Suspense>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-lg font-bold">お知らせを編集する</h2>
        <Suspense fallback={<Loading />}>
          <EditForm params={params} />
        </Suspense>
      </section>
    </AdminShell>
  );
}

async function BackLink({ params }: { params: PageProps<"/admin/notices/[id]/edit">["params"] }) {
  const { id } = await params;
  return (
    <Link href={`/admin/reads/${id}`} className="flex min-h-11 items-center text-base text-primary">
      ‹ 編集をやめて戻る
    </Link>
  );
}
