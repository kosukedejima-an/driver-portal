import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { siteConfig } from "@/config/site";
import { hasAdmin } from "./actions";
import { SetupForm } from "./SetupForm";

async function SetupContent() {
  await connection();
  const state = await hasAdmin();
  if (state === "no-key") {
    return <p className="text-base text-gold">SUPABASE_SERVICE_ROLE_KEY が登録されていません。README の手順を確かめてください。</p>;
  }
  if (state === "no-db") {
    return <p className="text-base text-gold">データベースの設定がまだのようです。Supabase の SQL Editor で supabase/setup.sql を実行してください。</p>;
  }
  if (state) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base">はじめの設定は済んでいます。</p>
        <Link href="/login/admin" className="flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white">
          管理者ログインへ
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base leading-relaxed">
        {siteConfig.appName}へようこそ。最初の管理者を登録してください。この画面は、管理者がまだ1人もいないときだけ使えます。
      </p>
      <SetupForm />
    </div>
  );
}

export default function SetupPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="はじめの設定" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Suspense fallback={<Loading />}>
          <SetupContent />
        </Suspense>
      </main>
    </div>
  );
}
