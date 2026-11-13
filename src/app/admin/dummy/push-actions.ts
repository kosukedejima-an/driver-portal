"use server";

import webpush from "web-push";
import { requireAdmin } from "@/lib/auth";

/** 通知用の鍵（公開用と秘密の2つ）を新しく作って、画面に表示するだけ（どこにも保存しない） */
export async function generatePushKeys(): Promise<{ publicKey: string; privateKey: string }> {
  await requireAdmin();
  return webpush.generateVAPIDKeys();
}
