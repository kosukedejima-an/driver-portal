import Link from "next/link";

const ITEMS = [
  { href: "/admin/reads", label: "表示中" },
  { href: "/admin/hidden", label: "非表示" },
  { href: "/admin/logs", label: "操作履歴" },
] as const;

/** 既読確認タブの中の切り替え（表示中／非表示／操作履歴） */
export function AdminNoticeNav({ current }: { current: (typeof ITEMS)[number]["href"] }) {
  return (
    <nav className="grid grid-cols-3 overflow-hidden rounded-lg border border-primary lg:max-w-xl">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={current === item.href ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center text-base ${
            current === item.href ? "bg-primary font-bold text-white" : "bg-white text-primary"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
