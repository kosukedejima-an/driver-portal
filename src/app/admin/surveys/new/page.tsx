import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { SurveyBuilder } from "./SurveyBuilder";

async function Builder() {
  await requireAdmin();
  return <SurveyBuilder />;
}

export default function NewSurveyPage() {
  return (
    <AdminShell current="/admin/surveys" width="narrow">
      <Link href="/admin/surveys" className="flex min-h-11 items-center text-base text-primary">
        ‹ アンケートの一覧に戻る
      </Link>
      <h2 className="text-lg font-bold">新しいアンケートを作る</h2>
      <Suspense fallback={<Loading />}>
        <Builder />
      </Suspense>
    </AdminShell>
  );
}
