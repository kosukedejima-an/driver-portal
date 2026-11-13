import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { LikeTarget } from "@/lib/timeline";

/** 管理者向け：この投稿にいいねした人の一覧 */
export async function LikersSection({ type, id }: { type: LikeTarget; id: string }) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("post_likes")
    .select("user_id, created_at, profiles(full_name, employee_no)")
    .eq("target_type", type)
    .eq("target_id", id)
    .order("created_at", { ascending: false });
  if (error) return null; // supabase/setup.sql 実行前
  const likers = data as unknown as { user_id: string; created_at: string; profiles: { full_name: string; employee_no: string | null } | null }[];
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-base font-bold">いいね（{likers.length}人）</h3>
      {likers.length === 0 ? (
        <p className="mt-2 text-base text-gray-600">まだいいねはありません。</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {likers.map((l) => (
            <li key={l.user_id} className="flex min-h-11 items-center justify-between gap-2 text-base">
              <span>{l.profiles?.full_name ?? "（削除された社員）"}</span>
              <span className="text-sm text-gray-600">{formatDateTime(l.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
