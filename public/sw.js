// サービスワーカー：アプリを閉じていてもスマホで動く小さなプログラム。
// 通知を受け取って表示し、押されたらそのお知らせを開く。ホーム画面のアイコンの数字も更新する。

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "新しいお知らせがあります", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "新しいお知らせがあります";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
  };
  const tasks = [self.registration.showNotification(title, options)];
  // ホーム画面のアイコンに未読件数を表示（対応している機種のみ）
  if (typeof data.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tasks.push(
      (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {}),
    );
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // 自分のアプリの中のページだけを開く
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(target.href);
          return;
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
