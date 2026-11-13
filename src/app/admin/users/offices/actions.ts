"use server";

// 営業所の追加・名前の変更・並べ替え・削除（管理者のみ。権限はデータベース側でも確認している）
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export type OfficeResult = { ok: boolean; message: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addOffice(_prev: OfficeResult, formData: FormData): Promise<OfficeResult> {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!name) return { ok: false, message: "営業所の名前を入力してください。" };
  const { data: last } = await supabase.from("offices").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("offices").insert({ name, sort_order: ((last?.[0]?.sort_order as number) ?? 0) + 1 });
  if (error) return { ok: false, message: error.code === "23505" ? "同じ名前の営業所がすでにあります。" : "追加できませんでした。" };
  refresh();
  return { ok: true, message: `「${name}」を追加しました。` };
}

export async function renameOffice(_prev: OfficeResult, formData: FormData): Promise<OfficeResult> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  if (!UUID_PATTERN.test(id) || !name) return { ok: false, message: "名前を入力してください。" };
  const { error } = await supabase.from("offices").update({ name }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23505" ? "同じ名前の営業所がすでにあります。" : "変更できませんでした。" };
  refresh();
  return { ok: true, message: "名前を変えました。" };
}

/** 並べ替え（1つ上・1つ下と入れ替える） */
export async function moveOffice(id: string, direction: -1 | 1): Promise<OfficeResult> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("offices").select("id, sort_order").order("sort_order");
  const list = (data ?? []) as { id: string; sort_order: number }[];
  const i = list.findIndex((o) => o.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return { ok: false, message: null };
  const ordered = list.map((o) => o.id);
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  await Promise.all(ordered.map((oid, k) => supabase.from("offices").update({ sort_order: k + 1 }).eq("id", oid)));
  refresh();
  return { ok: true, message: null };
}

/** 削除（所属している社員がいない営業所だけ） */
export async function deleteOffice(id: string): Promise<OfficeResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, message: null };
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("office_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, message: `この営業所には社員が${count}人います（退職者を含む）。先に別の営業所に移してください。` };
  }
  const { error } = await supabase.from("offices").delete().eq("id", id);
  if (error) return { ok: false, message: "削除できませんでした。" };
  refresh();
  return { ok: true, message: "営業所を削除しました。" };
}
