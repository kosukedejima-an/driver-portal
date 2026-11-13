import { PageHeader } from "./PageHeader";

/**
 * ドライバー画面の枠。
 * ホーム以外は、左上の「‹ ホーム」でホームに戻れる。
 */
export function DriverShell({
  title,
  brand = true,
  backHref = "/",
  actions,
  children,
}: {
  title: string;
  /** false にすると、ロゴの帯を付けない（ホーム用） */
  brand?: boolean;
  /** 左上の戻る先。null で非表示（ホーム用） */
  backHref?: string | null;
  /** 見出しの右側に置くボタン（ホームのベル・人型など） */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={title} brand={brand} backHref={backHref ?? undefined} backLabel="ホーム" actions={actions} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-10">{children}</main>
    </div>
  );
}
