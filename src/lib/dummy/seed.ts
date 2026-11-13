// ダミーデータを入れる・消す処理。管理者の操作からだけ呼ぶ（強い権限のキーを使うため）。
import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { employeeNoToEmail } from "@/lib/employee";
import { DUMMY_DRIVER_NAMES, DUMMY_NOTICES, OFFICES, dummyEmployeeNo } from "./data";
import { clearDummyLibrary, seedDummyLibrary } from "./library";
import { clearDummySurveys, seedDummyLikes, seedDummySurveys } from "./surveys";

/** 毎回同じ並びになる乱数（確認済み・未確認の混ざり方を毎回そろえるため） */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * どのダミー社員がどのお知らせを確認済みにするかを決める。
 * 社員ごとに「よく確認する人」から「ほとんど確認しない人」まで差をつけ、
 * お知らせごとの確認率はおおむね readRate に近づける。
 */
export function planReads(readRates: number[], driverCount: number): boolean[][] {
  const random = seededRandom(20261007);
  return readRates.map((rate) =>
    Array.from({ length: driverCount }, (_, j) => {
      const tendency = driverCount > 1 ? j / (driverCount - 1) : 0; // 0 = よく確認する人
      return 0.5 * random() + 0.5 * tendency < rate;
    }),
  );
}

/** ダミーの印が付いたお知らせと社員を消す（本物は消えない） */
export async function clearDummyData(admin: SupabaseClient) {
  const surveys = await clearDummySurveys(admin);
  const library = await clearDummyLibrary(admin);
  const { data: deletedNotices, error: noticeError } = await admin
    .from("notices")
    .delete()
    .eq("is_dummy", true)
    .select("id");
  if (noticeError) throw noticeError;

  const { data: dummyProfiles, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_dummy", true);
  if (profileError) throw profileError;

  // ログイン用アカウントを消すと、社員情報と確認記録も一緒に消える
  const results = await Promise.all(
    dummyProfiles.map((p) => admin.auth.admin.deleteUser(p.id as string)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  return { notices: deletedNotices.length, employees: dummyProfiles.length, surveys, library };
}

/** ダミーデータを入れる（すでにある場合は、いったん消してから入れ直す） */
export async function seedDummyData(admin: SupabaseClient) {
  await clearDummyData(admin);

  // 営業所：登録済みのものを表示順に使う。1つもなければ営業所を作る
  let { data: offices } = await admin.from("offices").select("id").order("sort_order");
  if (!offices || offices.length === 0) {
    const { data, error } = await admin
      .from("offices")
      .insert(OFFICES.map((name, i) => ({ name, sort_order: i + 1 })))
      .select("id");
    if (error) throw error;
    offices = data;
  }

  // ダミー社員：ログインできないよう、パスワードは毎回ランダムにする（必要なら社員管理で再設定）
  const created = await Promise.all(
    DUMMY_DRIVER_NAMES.map((_, i) =>
      admin.auth.admin.createUser({
        email: employeeNoToEmail(dummyEmployeeNo(i)),
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
      }),
    ),
  );
  const createFailed = created.find((r) => r.error || !r.data.user);
  if (createFailed) {
    // 作りかけのアカウントを片付ける
    await Promise.all(
      created.filter((r) => r.data.user).map((r) => admin.auth.admin.deleteUser(r.data.user!.id)),
    );
    throw createFailed.error ?? new Error("ダミー社員を作成できませんでした");
  }
  const driverIds = created.map((r) => r.data.user!.id);

  const { error: profilesError } = await admin.from("profiles").insert(
    driverIds.map((id, i) => ({
      id,
      employee_no: dummyEmployeeNo(i),
      full_name: DUMMY_DRIVER_NAMES[i],
      office_id: offices![i % offices!.length].id,
      role: "driver",
      is_dummy: true,
    })),
  );
  if (profilesError) {
    await Promise.all(driverIds.map((id) => admin.auth.admin.deleteUser(id)));
    throw profilesError;
  }

  // お知らせ
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const { data: notices, error: noticesError } = await admin
    .from("notices")
    .insert(
      DUMMY_NOTICES.map((n) => ({
        category: n.category,
        title: n.title,
        body: n.body ?? null,
        accident_situation: n.accident?.situation ?? null,
        accident_cause: n.accident?.cause ?? null,
        accident_prevention: n.accident?.prevention ?? null,
        author_label: n.author_label,
        published_at: new Date(now - n.hoursAgo * hour).toISOString(),
        is_dummy: true,
      })),
    )
    .select("id");
  if (noticesError) throw noticesError;

  // 確認記録（確認した時刻は、投稿から現在までの間のどこか）
  const plan = planReads(
    DUMMY_NOTICES.map((n) => n.readRate),
    driverIds.length,
  );
  const timing = seededRandom(7);
  const reads = plan.flatMap((row, i) =>
    row.flatMap((isRead, j) => {
      if (!isRead) return [];
      const hoursAfter = 0.2 + timing() * (DUMMY_NOTICES[i].hoursAgo - 0.3);
      return [
        {
          notice_id: notices[i].id,
          user_id: driverIds[j],
          read_at: new Date(now - (DUMMY_NOTICES[i].hoursAgo - hoursAfter) * hour).toISOString(),
        },
      ];
    }),
  );
  if (reads.length > 0) {
    const { error: readsError } = await admin.from("notice_reads").insert(reads);
    if (readsError) throw readsError;
  }

  const surveys = await seedDummySurveys(admin, driverIds);
  await seedDummyLikes(admin, driverIds);
  const library = await seedDummyLibrary(admin, driverIds);

  return { notices: notices.length, employees: driverIds.length, reads: reads.length, surveys, library };
}
