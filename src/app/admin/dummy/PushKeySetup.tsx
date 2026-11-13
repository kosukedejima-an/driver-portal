"use client";

import { useState, useTransition } from "react";
import { generatePushKeys } from "./push-actions";

function CopyField({ label, name, value }: { label: string; name: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-base font-bold">{label}</span>
      <span className="text-sm text-gray-600">
        Vercel の名前（Key）：<code className="font-bold text-primary">{name}</code>
      </span>
      <textarea readOnly value={value} rows={2} className="rounded-lg border border-gray-300 p-2 font-mono text-sm break-all" />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="min-h-11 rounded-lg border-2 border-primary bg-white text-base font-bold text-primary"
      >
        {copied ? "コピーしました" : "値をコピー"}
      </button>
    </div>
  );
}

/** 通知用の鍵を作る（管理者が Vercel に登録するため） */
export function PushKeySetup({ configured }: { configured: boolean }) {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () => {
    if (
      configured &&
      !window.confirm(
        "通知用の鍵はすでに設定されています。新しい鍵に変えると、全員がもう一度「通知を受け取る」をオンにする必要があります。作りますか？",
      )
    ) {
      return;
    }
    startTransition(async () => setKeys(await generatePushKeys()));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base">
        現在の状態：
        <span className={`font-bold ${configured ? "text-primary" : "text-gold"}`}>
          {configured ? "設定済み（通知を送れます）" : "未設定（通知は送られません）"}
        </span>
      </p>
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="min-h-12 rounded-lg bg-primary text-base font-bold text-white disabled:opacity-60"
      >
        {pending ? "作成中…" : "通知用の鍵を作る"}
      </button>
      {keys && (
        <div className="flex flex-col gap-4 rounded-lg border-2 border-gold-line p-3">
          <p className="text-base font-bold text-gold">
            2つの値を Vercel に登録してください。秘密の鍵は、チャット・メール・LINEなどに貼らないでください。この画面を閉じると、同じ鍵は二度と表示されません。
          </p>
          <CopyField label="① 公開用の鍵" name="NEXT_PUBLIC_VAPID_PUBLIC_KEY" value={keys.publicKey} />
          <CopyField label="② 秘密の鍵" name="VAPID_PRIVATE_KEY" value={keys.privateKey} />
        </div>
      )}
    </div>
  );
}
