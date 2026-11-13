import Link from "next/link";
import { Logo } from "./Logo";

const TABS = [
  { href: "/admin/dispatch", label: "配車表" },
  { href: "/admin/reads", label: "既読確認" },
  { href: "/admin/notices/new", label: "新規投稿" },
  { href: "/admin/surveys", label: "アンケート" },
  { href: "/admin/library", label: "情報集" },
  { href: "/admin/instagram", label: "インスタ" },
  { href: "/admin/users", label: "社員管理" },
  { href: "/admin/dummy", label: "テスト用" },
] as const;

export type AdminTab = (typeof TABS)[number]["href"];

/**
 * 管理者画面の枠（上部にタブ）。PCではブラウザの幅に合わせて広がる。
 * width="narrow"：入力フォームや記録など、横に広げると読みにくい画面は読みやすい幅にとどめる
 */
export function AdminShell({ current, width = "wide", children }: { current: AdminTab; width?: "wide" | "narrow"; children: React.ReactNode }) {
  const frame = "mx-auto w-full max-w-screen-2xl px-4 lg:px-8";
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-primary text-white">
        {/* 見出しがマルーンなので、ゴールドの線は入れずにロゴだけ */}
        <div className={`${frame} flex h-10 items-center`}>
          <Logo />
        </div>
        <div className={`${frame} flex min-h-12 items-center justify-between gap-2`}>
          <h1 className="text-lg font-bold">管理者メニュー</h1>
          <Link href="/" className="flex min-h-11 items-center px-2 text-base">
            ドライバー画面へ
          </Link>
        </div>
        {/* タブが増えたので、スマホでは横にスクロールできるようにする */}
        <nav className="mx-auto max-w-screen-2xl overflow-x-auto lg:px-4">
          <ul className="flex min-w-full">
            {TABS.map((t) => (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={current === t.href ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center border-b-4 px-3 text-sm whitespace-nowrap lg:text-base ${
                    current === t.href ? "border-white font-bold" : "border-transparent opacity-80"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-4 lg:px-8 lg:py-6 ${width === "wide" ? "max-w-screen-2xl" : "max-w-3xl"}`}>
        {children}
      </main>
    </div>
  );
}
