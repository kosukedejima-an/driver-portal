import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { fetchAll } from "@/lib/fetch-all";
import { OfficeManager } from "./OfficeManager";

async function Offices() {
  const { supabase } = await requireAdmin();
  const [{ data }, people] = await Promise.all([
    supabase.from("offices").select("id, name").order("sort_order"),
    fetchAll<{ office_id: string | null }>((f, t) => supabase.from("profiles").select("office_id").range(f, t)),
  ]);
  const counts: Record<string, number> = {};
  for (const p of people) if (p.office_id) counts[p.office_id] = (counts[p.office_id] ?? 0) + 1;
  return <OfficeManager offices={(data ?? []) as { id: string; name: string }[]} counts={counts} />;
}

export default function OfficesPage() {
  return (
    <AdminShell current="/admin/users" width="narrow">
      <Link href="/admin/users" className="flex min-h-11 items-center text-base text-primary">
        ‹ 社員管理に戻る
      </Link>
      <Suspense fallback={<Loading />}>
        <Offices />
      </Suspense>
    </AdminShell>
  );
}
