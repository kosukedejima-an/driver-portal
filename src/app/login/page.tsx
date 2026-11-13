import { siteConfig } from "@/config/site";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DriverLoginForm } from "./LoginForm";
import { ReasonMessage } from "./ReasonMessage";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={siteConfig.appName} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h2 className="mb-6 text-xl font-bold">社員番号を入力してください</h2>
        <Suspense fallback={null}>
          <ReasonMessage searchParams={searchParams} />
        </Suspense>
        <DriverLoginForm />
        <Link
          href="/login/admin"
          className="mt-8 flex min-h-11 items-center justify-center text-base text-primary underline"
        >
          管理者の方はこちら
        </Link>
      </main>
    </div>
  );
}
