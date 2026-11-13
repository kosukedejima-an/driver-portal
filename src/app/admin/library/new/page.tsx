import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { LibraryForm } from "../LibraryForm";

async function NewForm() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("library_genres").select("id, name").order("sort_order");
  if (error) return <p className="text-base text-gold">データベースの設定（supabase/setup.sql）がまだのようです。</p>;
  return <LibraryForm genres={data as { id: string; name: string }[]} />;
}

export default function NewLibraryPage() {
  return (
    <AdminShell current="/admin/library" width="narrow">
      <Link href="/admin/library" className="flex min-h-11 items-center text-base text-primary">
        ‹ 情報集の一覧に戻る
      </Link>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-lg font-bold">資料を登録する</h2>
        <Suspense fallback={<Loading />}>
          <NewForm />
        </Suspense>
      </section>
    </AdminShell>
  );
}
