import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/fetch-all";
import { GenreManager } from "./GenreManager";

async function Genres() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("library_genres").select("id, name").order("sort_order");
  if (error) return <p className="text-base text-gold">データベースの設定（supabase/setup.sql）がまだのようです。</p>;
  const items = await fetchAll<{ genre_id: string }>((f, t) => supabase.from("library_items").select("genre_id").range(f, t));
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.genre_id] = (counts[i.genre_id] ?? 0) + 1;
  return <GenreManager genres={data as { id: string; name: string }[]} counts={counts} />;
}

export default function GenresPage() {
  return (
    <AdminShell current="/admin/library" width="narrow">
      <Link href="/admin/library" className="flex min-h-11 items-center text-base text-primary">
        ‹ 情報集の一覧に戻る
      </Link>
      <Suspense fallback={<Loading />}>
        <Genres />
      </Suspense>
    </AdminShell>
  );
}
