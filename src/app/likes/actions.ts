"use server";

import { requireProfile } from "@/lib/auth";
import type { LikeTarget } from "@/lib/timeline";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** いいねを付ける・外す（1人1回。権限はデータベース側でも確認している） */
export async function setLike(type: LikeTarget, id: string, like: boolean): Promise<{ ok: boolean }> {
  const { supabase, profile } = await requireProfile();
  if (!["notice", "survey", "instagram"].includes(type) || !UUID_PATTERN.test(id)) return { ok: false };
  const { error } = like
    ? await supabase
        .from("post_likes")
        .upsert({ target_type: type, target_id: id, user_id: profile.id }, { onConflict: "target_type,target_id,user_id", ignoreDuplicates: true })
    : await supabase.from("post_likes").delete().eq("target_type", type).eq("target_id", id).eq("user_id", profile.id);
  return { ok: !error };
}
