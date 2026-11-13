import { siteConfig } from "@/config/site";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { DummyBadge } from "@/components/DummyBadge";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/fetch-all";
import type { Office, Profile } from "@/lib/types";
import { AddEmployeeForm, DeleteEmployeeButton, ResetPasswordForm, RoleToggle, StatusToggle } from "./forms";
import { ScrollToCurrentTab } from "./ScrollToCurrentTab";

const LIMIT = 300;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Search = { status: "active" | "retired"; office: string; q: string; done: string };

const DONE_MESSAGES: Record<string, string> = {
  retired: "退職（利用停止）にしました。この社員番号では入れなくなりました。「退職者一覧」から再開や完全な削除ができます。",
  resumed: "利用を再開しました。また社員番号で入れます。「在籍中」に戻っています。",
  deleted: "完全に削除しました。削除の記録は「変更記録」に残っています。",
};
type Employee = Profile & { company?: string };

function readSearch(sp: Record<string, string | string[] | undefined>): Search {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  // 検索の文字から、検索の仕組みを乱す記号を取り除く
  const q = one(sp.q).replace(/[,()%*\\]/g, " ").trim().slice(0, 30);
  const office = UUID_PATTERN.test(one(sp.office)) ? one(sp.office) : "";
  return { status: one(sp.status) === "retired" ? "retired" : "active", office, q, done: one(sp.done) };
}

function hrefWith(s: Search, patch: Partial<Search>) {
  const next = { ...s, ...patch };
  const p = new URLSearchParams();
  if (next.status === "retired") p.set("status", "retired");
  if (next.office) p.set("office", next.office);
  if (next.q) p.set("q", next.q);
  // 操作の結果の表示（done）は、別の一覧に移るときは引き継がない
  const qs = p.toString();
  return `/admin/users${qs ? `?${qs}` : ""}`;
}

async function UsersContent({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const s = readSearch(await searchParams);
  const { supabase, profile: me } = await requireAdmin();

  let query = supabase
    .from("profiles")
    .select("*")
    .eq("is_active", s.status === "active")
    .order("employee_no")
    .limit(LIMIT + 1);
  if (s.office) query = query.eq("office_id", s.office);
  if (s.q) query = query.or(`full_name.ilike.%${s.q}%,employee_no.ilike.%${s.q}%`);

  // 一覧・営業所・タブの人数（在籍中の全員の営業所）は、同時に取りに行く
  const [officesRes, listRes, activeOffices] = await Promise.all([
    supabase.from("offices").select("id, name").order("sort_order"),
    query,
    fetchAll<{ office_id: string | null }>((f, t) => supabase.from("profiles").select("office_id").eq("is_active", true).range(f, t)),
  ]);
  const offices = (officesRes.data ?? []) as Office[];
  // タブに出す営業所ごとの在籍人数（退職者は数えない）
  const officeCounts = offices.map((o) => activeOffices.filter((p) => p.office_id === o.id).length);
  const totalCount = { count: activeOffices.length };
  if (listRes.error) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        社員の一覧を読み込めませんでした。データベースの設定（supabase/setup.sql）が済んでいるか確認してください。
      </p>
    );
  }
  const order = new Map(offices.map((o, i) => [o.id, i]));
  const all = listRes.data as Employee[];
  const tooMany = all.length > LIMIT;
  const list = all
    .slice(0, LIMIT)
    .sort((a, b) => (order.get(a.office_id ?? "") ?? 99) - (order.get(b.office_id ?? "") ?? 99));
  const officeName = (id: string | null) => offices.find((o) => o.id === id)?.name ?? "所属なし";
  const retired = s.status === "retired";

  return (
    <>
      {DONE_MESSAGES[s.done] && (
        <p role="status" className="rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">
          {DONE_MESSAGES[s.done]}
        </p>
      )}
      {!retired && (
        <div className="-mb-2 flex justify-end">
          <Link href={hrefWith(s, { status: "retired", office: "", q: "" })} className="flex min-h-11 items-center px-1 text-sm text-primary underline">
            退職者一覧
          </Link>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 lg:max-w-2xl">
        <Link
          href="/admin/users/offices"
          className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary bg-white text-center text-base font-bold text-primary"
        >
          営業所の管理
        </Link>
        <Link
          href="/admin/users/import"
          className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary bg-white text-base font-bold text-primary"
        >
          CSVで取り込む
        </Link>
        <Link
          href="/admin/users/logs"
          className="flex min-h-12 items-center justify-center rounded-lg border-2 border-primary bg-white text-base font-bold text-primary"
        >
          変更記録
        </Link>
      </div>

      <details className="rounded-lg border border-gray-200 bg-white p-4 lg:max-w-3xl">
        <summary className="flex min-h-11 cursor-pointer items-center text-lg font-bold">社員を1人登録する</summary>
        <div className="mt-3">
          <AddEmployeeForm offices={offices} />
        </div>
      </details>

      {retired ? (
        <Link href="/admin/users" className="flex min-h-11 items-center text-base text-primary">
          ‹ 在籍中の社員に戻る
        </Link>
      ) : (
        <>
          {/* 営業所ごとのタブ（スマホでは横にスクロール）。人数は在籍中のみ */}
          <nav aria-label="営業所" className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex w-max gap-2">
              {[
                { id: "", name: "全体", count: totalCount.count ?? 0 },
                ...offices.map((o, i) => ({ id: o.id, name: o.name, count: officeCounts[i] })),
              ].map((tab) => {
                const current = s.office === tab.id;
                return (
                  <li key={tab.id || "all"}>
                    <Link
                      href={hrefWith(s, { office: tab.id, q: "" })}
                      aria-current={current ? "page" : undefined}
                      data-current-tab={current ? "" : undefined}
                      className={`flex min-h-11 items-center gap-1 rounded-full border px-4 text-sm whitespace-nowrap ${
                        current ? "border-primary bg-primary font-bold text-white" : "border-gray-300 bg-white text-primary"
                      }`}
                    >
                      {tab.name}
                      <span className={current ? "" : "text-gray-600"}>{tab.count}名</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ScrollToCurrentTab />
        </>
      )}

      {/* 氏名・社員番号で検索（選んでいるタブの中で絞り込む） */}
      <form action="/admin/users" method="get" className="flex gap-2 lg:max-w-xl">
        {retired && <input type="hidden" name="status" value="retired" />}
        {s.office && <input type="hidden" name="office" value={s.office} />}
        <label className="flex-1">
          <span className="sr-only">氏名か社員番号で検索</span>
          <input
            name="q"
            type="search"
            defaultValue={s.q}
            placeholder="氏名・社員番号で検索"
            className="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base"
          />
        </label>
        <button type="submit" className="min-h-12 shrink-0 rounded-lg bg-primary px-4 text-base font-bold text-white">
          検索
        </button>
      </form>
      {s.q && (
        <Link href={hrefWith(s, { q: "" })} className="-mt-2 flex min-h-11 items-center text-sm text-primary underline">
          「{s.q}」の検索をやめる
        </Link>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">
          {retired ? "退職者一覧" : `${s.office ? officeName(s.office) : "全体"}（${tooMany ? `${LIMIT}名以上` : `${list.length}名`}）`}
        </h2>
        {tooMany && (
          <p className="mt-1 text-sm text-gray-600">多いため最初の{LIMIT}人だけ表示しています。営業所や名前で絞り込んでください。</p>
        )}
        {retired && (
          <p className="mt-1 text-sm text-gray-600">
            退職者は入れず、既読確認の人数にも含めません。これまでの既読記録は残っています。
          </p>
        )}
        {list.length === 0 ? (
          <p className="mt-3 text-base text-gray-600">{retired ? "退職者はいません。" : "該当する社員はいません。"}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 lg:mt-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:divide-y-0 2xl:grid-cols-3">
            {list.map((p) => {
              const isMe = p.id === me.id;
              return (
                <li key={p.id} className="py-3 lg:rounded-lg lg:border lg:border-gray-200 lg:p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{p.full_name}</span>
                    {p.role === "admin" && <span className="rounded bg-primary px-2 py-0.5 text-sm text-white">管理者</span>}
                    {/* グループ会社（先頭以外の会社）の社員には会社名を出す */}
                    {siteConfig.companies.length > 1 && p.company && p.company !== siteConfig.companies[0] && (
                      <span className="rounded border border-gray-400 px-2 py-0.5 text-sm text-gray-700">{p.company}</span>
                    )}
                    {retired && <span className="rounded bg-gray-600 px-2 py-0.5 text-sm text-white">退職（利用停止）</span>}
                    {p.is_dummy && <DummyBadge />}
                    {isMe && <span className="text-sm text-gray-600">（あなた）</span>}
                  </div>
                  <p className="text-sm text-gray-600">
                    {p.employee_no ? `社員番号 ${p.employee_no}` : "社員番号なし"}・{officeName(p.office_id)}
                  </p>

                  <Link
                    href={`/admin/users/${p.id}/edit`}
                    className="mt-2 flex min-h-11 items-center justify-center rounded-lg bg-primary text-base font-bold text-white"
                  >
                    編集する
                  </Link>
                  {isMe ? (
                    <p className="mt-1 text-sm text-gray-600">自分自身の管理者権限は外せず、退職（利用停止）にもできません。</p>
                  ) : retired ? (
                    <div className="grid gap-x-2 sm:grid-cols-2">
                      <StatusToggle userId={p.id} active={false} name={p.full_name} />
                      <DeleteEmployeeButton userId={p.id} name={p.full_name} />
                    </div>
                  ) : (
                    <div className="grid gap-x-2 sm:grid-cols-2">
                      <RoleToggle userId={p.id} role={p.role} name={p.full_name} />
                      <StatusToggle userId={p.id} active name={p.full_name} />
                    </div>
                  )}
                  {/* パスワードは管理者用の入口でだけ使うため、在籍中の管理者の行にだけ出す */}
                  {!retired && p.role === "admin" && (
                    <details className="mt-1">
                      <summary className="flex min-h-11 cursor-pointer items-center text-base text-primary">
                        パスワードを設定する
                      </summary>
                      <ResetPasswordForm userId={p.id} />
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <AdminShell current="/admin/users">
      <Suspense fallback={<Loading />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}
