import Link from "next/link";
import { Suspense } from "react";
import { DriverShell } from "@/components/DriverShell";
import { Loading } from "@/components/Loading";
import { LogoutButton } from "@/components/LogoutButton";
import { PushSettings } from "@/components/PushSettings";
import { canUseAdmin, requireProfile } from "@/lib/auth";

async function MyPageContent() {
  const { supabase, profile } = await requireProfile();
  // 社員番号だけで入った場合は、管理者の社員でも管理者メニューは使えない
  const canAdmin = await canUseAdmin();
  const { data: office } = profile.office_id
    ? await supabase.from("offices").select("name").eq("id", profile.office_id).maybeSingle<{ name: string }>()
    : { data: null };

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">氏名</p>
        <p className="text-lg font-bold">{profile.full_name}</p>
        {profile.employee_no && (
          <>
            <p className="mt-3 text-sm text-gray-600">社員番号</p>
            <p className="text-base">{profile.employee_no}</p>
          </>
        )}
        <p className="mt-3 text-sm text-gray-600">所属</p>
        <p className="text-base">{office?.name ?? "所属なし"}</p>
      </section>

      {profile.role === "admin" &&
        (canAdmin ? (
          <Link
            href="/admin/reads"
            className="mt-4 flex min-h-12 items-center justify-center rounded-lg bg-primary text-base font-bold text-white"
          >
            管理者メニューへ
          </Link>
        ) : (
          <p className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-base">
            管理者メニューを使うには、ログアウトしてから「管理者の方はこちら」の入口で、社員番号とパスワードで入ってください。
          </p>
        ))}

      <PushSettings />
      <LogoutButton />
    </>
  );
}

export default function MyPage() {
  return (
    <DriverShell title="マイページ">
      <Suspense fallback={<Loading />}>
        <MyPageContent />
      </Suspense>
    </DriverShell>
  );
}
