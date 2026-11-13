import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { instagramPermalink, type InstagramPost } from "@/lib/instagram";
import { InstagramForm } from "./InstagramForm";

async function PostList() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("instagram_posts").select("*").order("published_at", { ascending: false }).limit(100);
  if (error) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。
      </p>
    );
  }
  const posts = data as InstagramPost[];
  if (posts.length === 0) return <p className="py-8 text-center text-base text-gray-600">まだ載せた投稿はありません。</p>;
  const { data: counts } = await supabase.rpc("post_like_counts", { p_type: "instagram", p_ids: posts.map((p) => p.id) });
  const likes = new Map(((counts ?? []) as { target_id: string; likes: number }[]).map((c) => [c.target_id, Number(c.likes)]));
  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/instagram/${p.id}`} className="block h-full rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">{formatDate(p.published_at)}</span>
              {p.hidden_at && <span className="rounded bg-gray-600 px-2 py-0.5 text-sm font-bold text-white">非表示中</span>}
              {p.is_dummy && <DummyBadge />}
            </div>
            <p className="mt-1 text-base leading-snug">{p.note ?? "（ひとことなし）"}</p>
            <p className="mt-1 text-sm break-all text-gray-600">{instagramPermalink(p.kind, p.shortcode)}</p>
            <p className="mt-2 text-sm font-bold">いいね {likes.get(p.id) ?? 0}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function DoneMessage({ searchParams }: { searchParams: PageProps<"/admin/instagram">["searchParams"] }) {
  const { done } = await searchParams;
  if (done !== "deleted") return null;
  return <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">投稿を完全に削除しました。</p>;
}

export default function AdminInstagramPage({ searchParams }: PageProps<"/admin/instagram">) {
  return (
    <AdminShell current="/admin/instagram">
      <Suspense fallback={null}>
        <DoneMessage searchParams={searchParams} />
      </Suspense>
      {/* PCでは左に載せるフォーム、右に一覧 */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-bold">Instagramの投稿を載せる</h2>
          <InstagramForm />
        </section>
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-gray-700">載せた投稿</h2>
          <Suspense fallback={<Loading />}>
            <PostList />
          </Suspense>
        </div>
      </div>
    </AdminShell>
  );
}
