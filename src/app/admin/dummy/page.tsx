import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Loading } from "@/components/Loading";
import { requireAdmin } from "@/lib/auth";
import { pushKeysConfigured } from "@/lib/push";
import { DummyButtons } from "./DummyButtons";
import { PushKeySetup } from "./PushKeySetup";

async function DummyStatus() {
  const { supabase } = await requireAdmin();
  const [notices, employees] = await Promise.all([
    supabase.from("notices").select("id", { count: "exact", head: true }).eq("is_dummy", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_dummy", true),
  ]);
  if (notices.error || employees.error) {
    return (
      <p className="rounded-lg border-2 border-gold-line bg-white p-3 text-base text-gold">
        データベースの設定（supabase/setup.sql）がまだのようです。先に Supabase で実行してください。
      </p>
    );
  }
  return (
    <p className="text-base">
      現在のダミーデータ：お知らせ <span className="font-bold">{notices.count ?? 0}</span> 件、社員{" "}
      <span className="font-bold">{employees.count ?? 0}</span> 人
    </p>
  );
}

export default function AdminDummyPage() {
  return (
    <AdminShell current="/admin/dummy" width="narrow">
      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">テスト用のダミーデータ</h2>
        <p className="text-base leading-relaxed">
          動作確認のための架空のお知らせ（10件）と架空の社員（26人。登録されている営業所に順番に振り分けます）を入れます。社員ごとに確認済み・未確認がばらつくようにしてあります。
        </p>
        <p className="text-sm leading-relaxed text-gray-600">
          ダミーには「ダミー」の印が付きます。「消す」ボタンは印が付いたものだけを消すため、本物のお知らせ・社員は消えません。ダミー社員でログインしたい場合は、社員管理でパスワードを再設定してください。
        </p>
        <Suspense fallback={<Loading />}>
          <DummyStatus />
        </Suspense>
        <DummyButtons />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">通知の設定</h2>
        <p className="text-base leading-relaxed">
          プッシュ通知を送るには、通知用の鍵（2つ）を Vercel に登録する必要があります。下のボタンで鍵を作り、表示された値を Vercel に登録してください。
        </p>
        <PushKeySetup configured={pushKeysConfigured()} />
      </section>
    </AdminShell>
  );
}
