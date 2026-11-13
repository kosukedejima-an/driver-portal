import Link from "next/link";
import { BackButton } from "./BackButton";
import { BrandBar } from "./BrandBar";

/**
 * 画面の見出し。
 * 通常：ロゴ入りの帯＋ゴールドの線の下に、白地の見出し。
 * brand={false}（ホーム）：帯なしで、マルーンの見出しだけ。
 */
export function PageHeader({
  title,
  backHref,
  backLabel = "戻る",
  backToPrevious,
  brand = true,
  actions,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  /** true なら「‹ 戻る」で一つ前の画面に戻る（前の画面がなければ backHref へ） */
  backToPrevious?: boolean;
  brand?: boolean;
  /** 右側に置くボタン */
  actions?: React.ReactNode;
}) {
  const titleRow = (
    <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-2 px-4">
      {backHref && backToPrevious && <BackButton fallback={backHref} />}
      {backHref && !backToPrevious && (
        <Link href={backHref} className="-ml-2 flex min-h-11 items-center rounded px-2 text-base">
          ‹ {backLabel}
        </Link>
      )}
      <h1 className="text-lg font-bold">{title}</h1>
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  );

  if (!brand) {
    return <header className="sticky top-0 z-10 bg-primary text-white">{titleRow}</header>;
  }
  return (
    <header className="sticky top-0 z-10 bg-white text-primary">
      <BrandBar />
      <div className="border-b border-gray-200">{titleRow}</div>
    </header>
  );
}
