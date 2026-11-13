"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { clearDummyData, seedDummyData } from "@/lib/dummy/seed";
import { createAdminClient } from "@/lib/supabase/admin";

export type DummyState = { ok: boolean; message: string | null };

const NO_KEY_MESSAGE =
  "管理者用のキー（SUPABASE_SERVICE_ROLE_KEY）が設定されていないため、この操作はできません。";

export async function insertDummy(): Promise<DummyState> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: NO_KEY_MESSAGE };
  try {
    const r = await seedDummyData(admin);
    refresh();
    return {
      ok: true,
      message: `ダミーデータを入れました（お知らせ${r.notices}件、社員${r.employees}人、確認記録${r.reads}件、アンケート${r.surveys}件、情報集${r.library}件）。`,
    };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message:
        "ダミーデータを入れられませんでした。データベースの設定（supabase/setup.sql）が済んでいるか確認してください。",
    };
  }
}

export async function removeDummy(): Promise<DummyState> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: NO_KEY_MESSAGE };
  try {
    const r = await clearDummyData(admin);
    refresh();
    return {
      ok: true,
      message: `ダミーデータを消しました（お知らせ${r.notices}件、社員${r.employees}人、アンケート${r.surveys}件、情報集${r.library}件）。本物のデータはそのままです。`,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "ダミーデータを消せませんでした。もう一度お試しください。" };
  }
}
