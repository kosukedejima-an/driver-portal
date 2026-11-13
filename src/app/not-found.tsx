import Link from "next/link";
import { BrandBar } from "@/components/BrandBar";

export default function NotFound() {
  return (
    <>
      <BrandBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-primary">ページが見つかりません</h1>
        <p className="text-base">お知らせが削除されたか、アドレスが間違っている可能性があります。</p>
        <Link
          href="/"
          className="flex min-h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-bold text-white"
        >
          ホームに戻る
        </Link>
      </main>
    </>
  );
}
