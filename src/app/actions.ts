"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";

/** 「内容を確認しました」：確認記録を保存する */
export async function confirmNotice(noticeId: string): Promise<{ error: string | null }> {
  const { supabase, profile } = await requireProfile();
  const { error } = await supabase
    .from("notice_reads")
    .upsert(
      { notice_id: noticeId, user_id: profile.id },
      { onConflict: "notice_id,user_id", ignoreDuplicates: true },
    );
  if (error) return { error: "保存できませんでした。通信状態を確認して、もう一度押してください。" };
  refresh();
  return { error: null };
}
