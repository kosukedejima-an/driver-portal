import Link from "next/link";

function MegaphoneIcon() {
  return (
    <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="4" width="5" height="5" rx="1" />
      <path d="m4.8 6.4 1.1 1.1 1.9-2" />
      <path d="M11.5 6.5h9" />
      <rect x="3.5" y="14" width="5" height="5" rx="1" />
      <path d="M11.5 16.5h9" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6.5h11v10h-11z" />
      <path d="M13.5 9.5h4l3 3.5v3.5h-7" />
      <circle cx="6.5" cy="17.5" r="1.8" fill="white" />
      <circle cx="17" cy="17.5" r="1.8" fill="white" />
    </svg>
  );
}

export type MenuItem = {
  href: string;
  label: string;
  icon: "dispatch" | "notice" | "library" | "survey";
  count: number;
  countLabel: string;
};

const ICONS = { dispatch: <TruckIcon />, notice: <MegaphoneIcon />, library: <BookIcon />, survey: <ChecklistIcon /> };

/** ホームの一番上のメニュー（アイコンと名前を1列に並べる）。未読・未回答があれば赤い丸の数字 */
export function HomeMenu({ items }: { items: MenuItem[] }) {
  return (
    <nav aria-label="メニュー" className="-mx-4 -mt-4 border-b border-gray-200 bg-white px-4">
      <ul className="mx-auto flex max-w-2xl">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-label={item.count > 0 ? `${item.label}（${item.countLabel}${item.count}件）` : item.label}
              className="relative flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-2 text-primary"
            >
              {ICONS[item.icon]}
              <span className="text-sm font-bold whitespace-nowrap">{item.label}</span>
              {item.count > 0 && (
                <span className="absolute top-1 right-1 flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-unread px-1 text-sm leading-5 font-bold text-white">
                  {item.count > 99 ? "99+" : item.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
