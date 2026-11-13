import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { DummyBadge } from "@/components/DummyBadge";
import { InstagramEmbed } from "@/components/InstagramEmbed";
import { LikersSection } from "@/components/LikersSection";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { instagramPermalink, type InstagramPost } from "@/lib/instagram";
import { InstagramControls } from "../InstagramControls";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Detail({ params }: { params: PageProps<"/admin/instagram/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data: post } = await supabase.from("instagram_posts").select("*").eq("id", id).maybeSingle<InstagramPost>();
  if (!post) notFound();
  const url = instagramPermalink(post.kind, post.shortcode);
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <section className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">{formatDateTime(post.published_at)} に載せました</span>
          {post.hidden_at && <span className="rounded bg-gray-600 px-2 py-0.5 text-sm font-bold text-white">非表示中</span>}
          {post.is_dummy && <DummyBadge />}
        </div>
        {post.note && <p className="mt-2 text-base whitespace-pre-wrap">{post.note}</p>}
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-11 items-center text-base break-all text-primary underline">
          {url}
        </a>
        <div className="mt-3">
          <InstagramControls id={post.id} hidden={Boolean(post.hidden_at)} />
        </div>
      </section>
      <LikersSection type="instagram" id={post.id} />
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <h3 className="p-4 pb-2 text-base font-bold">タイムラインでの見え方</h3>
        <InstagramEmbed kind={post.kind} shortcode={post.shortcode} />
      </section>
    </div>
  );
}

export default function AdminInstagramDetailPage({ params }: PageProps<"/admin/instagram/[id]">) {
  return (
    <AdminShell current="/admin/instagram">
      <Link href="/admin/instagram" className="flex min-h-11 items-center text-base text-primary">
        ‹ Instagramの一覧に戻る
      </Link>
      <Suspense fallback={<Loading />}>
        <Detail params={params} />
      </Suspense>
    </AdminShell>
  );
}
