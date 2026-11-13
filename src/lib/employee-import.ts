// 社員のCSV取り込み（サーバー側だけで使う）
// ファイルの中身はこの処理の中でだけ使い、保存したりログに書いたりしない。
import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { EMPLOYEE_NO_PATTERN, employeeNoToEmail } from "./employee";
import type { Office, Profile } from "./types";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_ROWS = 3000;
export const COLUMNS = ["employee_no", "name", "office", "company", "role", "active"] as const;
/** 所属会社の選択肢（src/config/site.ts で変える） */
export const COMPANIES: readonly string[] = siteConfig.companies;

type ProfileRow = Profile & { company?: string };

export type PlanRow = {
  line: number;
  employeeNo: string;
  name: string;
  office: string;
  action: "new" | "update" | "unchanged" | "error";
  /** 更新の場合の変更内容（例：「営業所：本社営業所 → 東営業所」） */
  changes: string[];
  reason?: string;
  /** 取り込みに使う値 */
  values?: { full_name: string; office_id: string; company: string; role: "driver" | "admin"; is_active: boolean };
  existingId?: string;
};

export type Plan = {
  rows: PlanRow[];
  counts: { new: number; update: number; unchanged: number; error: number };
};

/** 文字コード：UTF-8（BOMあり・なし）を優先し、読めなければ Excel の日本語CSV（Shift_JIS）として読む */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
}

/** CSV を行と列に分ける（"..." で囲んだ値・値の中のカンマや改行・"" に対応） */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 空の行は飛ばす
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** 会社名の「株式会社」「有限会社」「㈱」「(有)」などや空白を取り除いて比べる */
function normCompany(v: string): string {
  return v.replace(/株式会社|有限会社|合同会社|[（(]\s*[株有]\s*[）)]|㈱|㈲|\s/g, "");
}

function normRole(v: string): "driver" | "admin" | null {
  const s = v.trim().toLowerCase();
  if (["driver", "ドライバー", "運転手"].includes(s)) return "driver";
  if (["admin", "管理者"].includes(s)) return "admin";
  return null;
}

function normActive(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (s === "") return true;
  if (["true", "1", "yes", "y", "有効", "利用中", "在籍", "○", "〇"].includes(s)) return true;
  if (["false", "0", "no", "n", "無効", "停止", "利用停止", "退職", "×"].includes(s)) return false;
  return null;
}

const ROLE_LABEL = { driver: "ドライバー", admin: "管理者" };

/** 社員を全員取り出す（1000人を超えても取りこぼさないよう、分けて取り出す） */
async function fetchAllProfiles(supabase: SupabaseClient): Promise<ProfileRow[]> {
  const all: ProfileRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("profiles").select("*").range(from, from + 999);
    if (error) throw error;
    all.push(...(data as ProfileRow[]));
    if (data.length < 1000) return all;
  }
}

export type PlanError = { error: string };

/** ファイルを読んで、取り込み内容（新規・更新・エラー）を作る。データベースはまだ変えない */
export async function buildPlan(
  supabase: SupabaseClient,
  file: File,
  me: Profile,
): Promise<Plan | PlanError> {
  if (file.size === 0) return { error: "ファイルが空です。" };
  if (file.size > MAX_FILE_BYTES) return { error: "ファイルが大きすぎます（1MBまで）。" };

  const table = parseCsv(decodeCsv(new Uint8Array(await file.arrayBuffer())));
  if (table.length === 0) return { error: "ファイルに中身がありません。" };

  // 1行目は列名。並び順が違っても、名前で見分ける
  const header = table[0].map((h) => h.replace(/^﻿/, "").trim().toLowerCase());
  const missing = COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { error: `1行目に列名がありません：${missing.join("、")}（必要な列：${COLUMNS.join(", ")}）` };
  }
  const body = table.slice(1);
  if (body.length === 0) return { error: "社員の行がありません（1行目の列名だけです）。" };
  if (body.length > MAX_ROWS) return { error: `一度に取り込めるのは${MAX_ROWS}行までです。` };
  const col = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<(typeof COLUMNS)[number], number>;

  const [{ data: officesData, error: officeError }, profiles] = await Promise.all([
    supabase.from("offices").select("id, name").order("sort_order"),
    fetchAllProfiles(supabase),
  ]);
  if (officeError) throw officeError;
  if (profiles.length > 0 && !("company" in profiles[0])) {
    return { error: "データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。" };
  }
  const offices = (officesData ?? []) as Office[];
  const officeByName = new Map(offices.map((o) => [o.name, o]));
  const officeNameById = new Map(offices.map((o) => [o.id, o.name]));
  const existingByNo = new Map(
    profiles.filter((p) => p.employee_no).map((p) => [p.employee_no!.toLowerCase(), p]),
  );
  const seen = new Map<string, number>();

  const rows: PlanRow[] = body.map((cells, i) => {
    const line = i + 2;
    const get = (c: (typeof COLUMNS)[number]) => (cells[col[c]] ?? "").trim();
    const employeeNo = get("employee_no");
    const name = get("name");
    const officeInput = get("office");
    const base = { line, employeeNo, name, office: officeInput, changes: [] as string[] };
    const fail = (reason: string): PlanRow => ({ ...base, action: "error", reason });

    if (!employeeNo) return fail("社員番号（employee_no）が空です");
    if (!EMPLOYEE_NO_PATTERN.test(employeeNo)) return fail("社員番号は半角の英数字とハイフン（20文字以内）にしてください");
    const key = employeeNo.toLowerCase();
    if (seen.has(key)) return fail(`同じ社員番号が${seen.get(key)}行目にもあります`);
    seen.set(key, line);
    if (!name) return fail("氏名（name）が空です");
    if (name.length > 50) return fail("氏名が長すぎます（50文字まで）");

    // 営業所は名前で照らし合わせる。「横浜」のように「営業所」を省いた書き方も受け付ける
    const office = officeByName.get(officeInput) ?? officeByName.get(`${officeInput}営業所`);
    if (!officeInput) return fail("営業所（office）が空です");
    if (!office) return fail(`営業所「${officeInput}」が見つかりません（登録されている名前と同じにしてください）`);

    // 会社は空なら先頭の会社にする（1社だけなら書かなくてよい）
    const company = normCompany(get("company")) || COMPANIES[0];
    if (!COMPANIES.includes(company)) {
      return fail(`会社「${get("company")}」は使えません（${COMPANIES.join("・")} のどれか。「株式会社」「有限会社」は付けても付けなくても可）`);
    }
    const role = normRole(get("role"));
    if (!role) return fail(`役割「${get("role")}」は使えません（driver または admin）`);
    const active = normActive(get("active"));
    if (active === null) return fail(`利用状況「${get("active")}」は使えません（true または false）`);

    const existing = existingByNo.get(key);
    if (existing?.id === me.id && (role !== "admin" || !active)) {
      return fail("自分自身の管理者権限を外したり、利用停止にしたりはできません");
    }

    const values = { full_name: name, office_id: office.id, company, role, is_active: active };
    if (!existing) return { ...base, office: office.name, action: "new", values };

    const changes: string[] = [];
    if (existing.full_name !== name) changes.push(`氏名：${existing.full_name} → ${name}`);
    if (existing.office_id !== office.id) {
      changes.push(`営業所：${officeNameById.get(existing.office_id ?? "") ?? "なし"} → ${office.name}`);
    }
    if ((existing.company || COMPANIES[0]) !== company) changes.push(`会社：${existing.company || COMPANIES[0]} → ${company}`);
    if (existing.role !== role) changes.push(`役割：${ROLE_LABEL[existing.role]} → ${ROLE_LABEL[role]}`);
    if ((existing.is_active !== false) !== active) {
      changes.push(`利用状況：${existing.is_active !== false ? "利用中" : "利用停止"} → ${active ? "利用中" : "利用停止"}`);
    }
    return {
      ...base,
      office: office.name,
      action: changes.length ? "update" : "unchanged",
      changes,
      values,
      existingId: existing.id,
    };
  });

  const count = (a: PlanRow["action"]) => rows.filter((r) => r.action === a).length;
  return { rows, counts: { new: count("new"), update: count("update"), unchanged: count("unchanged"), error: count("error") } };
}

export type ApplyResult = {
  created: number;
  updated: number;
  failed: { line: number; employeeNo: string; reason: string }[];
};

function dbReason(error: { hint?: string; code?: string; message?: string }): string {
  if (error.hint === "self_demote" || error.hint === "self_suspend") return "自分自身の管理者権限・利用状況は変えられません";
  if (error.hint === "last_admin") return "利用中の管理者が1人もいなくなるため、変更できません";
  return "保存できませんでした";
}

/**
 * 取り込みを実行する（新規はログイン用アカウントも作る）。
 * 社員情報の保存はログイン中の管理者として行う（権限の変更記録に「だれが」が残るように）。
 */
export async function applyPlan(supabase: SupabaseClient, admin: SupabaseClient, plan: Plan): Promise<ApplyResult> {
  const result: ApplyResult = { created: 0, updated: 0, failed: [] };
  for (const row of plan.rows) {
    if (!row.values || (row.action !== "new" && row.action !== "update")) continue;
    const failed = (reason: string) => result.failed.push({ line: row.line, employeeNo: row.employeeNo, reason });

    if (row.action === "update") {
      const { error } = await supabase.from("profiles").update(row.values).eq("id", row.existingId!);
      if (error) failed(dbReason(error));
      else result.updated++;
      continue;
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: employeeNoToEmail(row.employeeNo),
      // ドライバーは社員番号だけで入るため、使われないランダムなパスワードを入れておく
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
    });
    if (createError || !created.user) {
      failed(createError?.code === "email_exists" ? "この社員番号のログイン情報がすでにあります" : "アカウントを作れませんでした");
      continue;
    }
    const { error } = await supabase
      .from("profiles")
      .insert({ id: created.user.id, employee_no: row.employeeNo, ...row.values });
    if (error) {
      await admin.auth.admin.deleteUser(created.user.id);
      failed(dbReason(error));
    } else result.created++;
  }
  return result;
}
