"use client";

import { useEffect } from "react";

/** 通知を受け取るためのサービスワーカー（public/sw.js）を登録する */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
