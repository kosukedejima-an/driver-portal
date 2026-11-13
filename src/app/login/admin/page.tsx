import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AdminLoginForm } from "../LoginForm";

async function SetupDone({ searchParams }: { searchParams: PageProps<"/login/admin">["searchParams"] }) {
  const { setup } = await searchParams;
  if (setup !== "done") return null;
  return (
    <p role="status" className="mb-6 rounded-lg bg-primary/10 p-3 text-base font-bold text-primary">
      最初の管理者を登録しました。登録した社員番号とパスワードで入ってください。
    </p>
  );
}

export default function AdminLoginPage({ searchParams }: PageProps<"/login/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="管理者ログイン" backHref="/login" backLabel="戻る" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Suspense fallback={null}>
          <SetupDone searchParams={searchParams} />
        </Suspense>
        <p className="mb-6 text-base leading-relaxed">
          管理者メニュー（投稿・既読確認・社員管理）を使うには、社員番号とパスワードで入ってください。
        </p>
        <AdminLoginForm />
      </main>
    </div>
  );
}
