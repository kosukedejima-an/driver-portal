"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 資料を開いたことを記録する（最新の内容を見たかどうかの判定に使う） */
export async function recordLibraryView(itemId: string): Promise<void> {
  if (!UUID_PATTERN.test(itemId)) return;
  const { supabase, profile } = await requireProfile();
  await supabase
    .from("library_views")
    .upsert({ item_id: itemId, user_id: profile.id, viewed_at: new Date().toISOString() }, { onConflict: "item_id,user_id" });
}

/** 「内容を確認しました」：確認ボタンのある資料で、確認した記録を残す */
export async function confirmLibraryItem(itemId: string): Promise<{ error: string | null }> {
  if (!UUID_PATTERN.test(itemId)) return { error: "資料が見つかりません。" };
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("confirm_library_item", { p_item_id: itemId });
  if (error) return { error: "保存できませんでした。通信状態を確認して、もう一度押してください。" };
  refresh();
  return { error: null };
}
