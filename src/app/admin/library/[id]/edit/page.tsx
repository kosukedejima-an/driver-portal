import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { LIBRARY_BUCKET, type LibraryItem } from "@/lib/library";
import { LibraryForm } from "../../LibraryForm";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditForm({ params }: { params: PageProps<"/admin/library/[id]/edit">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const [{ data: item }, { data: genres }] = await Promise.all([
    supabase.from("library_items").select("*").eq("id", id).maybeSingle<LibraryItem>(),
    supabase.from("library_genres").select("id, name").order("sort_order"),
  ]);
  if (!item) notFound();
  const signed = item.photo_paths.length ? (await supabase.storage.from(LIBRARY_BUCKET).createSignedUrls(item.photo_paths, 60 * 60)).data ?? [] : [];
  return (
    <LibraryForm
      genres={(genres ?? []) as { id: string; name: string }[]}
      item={{
        id: item.id,
        genre_id: item.genre_id,
        title: item.title,
        body: item.body,
        photos: item.photo_paths.map((path, i) => ({ path, url: signed[i]?.signedUrl ?? null })),
        pdf: item.pdf_path ? { path: item.pdf_path, name: item.pdf_name ?? "資料.pdf" } : null,
        requiresConfirm: Boolean(item.requires_confirm),
      }}
    />
  );
}

export default function EditLibraryPage({ params }: PageProps<"/admin/library/[id]/edit">) {
  return (
    <AdminShell current="/admin/library" width="narrow">
      <Link href="/admin/library" className="flex min-h-11 items-center text-base text-primary">
        ‹ 情報集の一覧に戻る
      </Link>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-lg font-bold">資料を直す</h2>
        <Suspense fallback={<Loading />}>
          <EditForm params={params} />
        </Suspense>
      </section>
    </AdminShell>
  );
}
