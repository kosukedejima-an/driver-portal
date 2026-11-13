import { siteConfig } from "@/config/site";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { ImportForm } from "./ImportForm";

async function ImportContent() {
  await requireAdmin();
  return <ImportForm />;
}

export default function ImportPage() {
  return (
    <AdminShell current="/admin/users" width="narrow">
      <Link href="/admin/users" className="flex min-h-11 items-center text-base text-primary">
        ‹ 社員管理に戻る
      </Link>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">社員のCSV取り込み</h2>
        <p className="mt-2 text-base leading-relaxed">1行目に次の列名を入れ、2行目から1人1行で書いてください。</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-bold">employee_no</dt>
          <dd>社員番号（同じ番号の社員がいれば上書き更新）</dd>
          <dt className="font-bold">name</dt>
          <dd>氏名</dd>
          <dt className="font-bold">office</dt>
          <dd>営業所名（「社員管理」→「営業所の管理」に登録してある名前）</dd>
          <dt className="font-bold">company</dt>
          <dd>所属会社（{siteConfig.companies.join("・")} のどれか。空なら「{siteConfig.companies[0]}」。「株式会社」などは付けても付けなくても可）</dd>
          <dt className="font-bold">role</dt>
          <dd>driver（ドライバー）または admin（管理者）</dd>
          <dt className="font-bold">active</dt>
          <dd>true（利用中）または false（利用停止）</dd>
        </dl>
        <p className="mt-2 text-sm text-gray-600">
          Excel で「CSV」形式で保存したファイルをそのまま使えます。ファイルはこの取り込みの間だけ読み、保存しません。CSVに書かれていない社員は、そのまま残ります。
        </p>
      </section>
      <Suspense fallback={<Loading />}>
        <ImportContent />
      </Suspense>
    </AdminShell>
  );
}
