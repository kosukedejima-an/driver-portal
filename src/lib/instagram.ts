// Instagram の投稿（タイムラインに埋め込んで表示する。通知・既読確認はなし）

export type InstagramKind = "p" | "reel" | "tv";

export type InstagramPost = {
  id: string;
  kind: InstagramKind;
  shortcode: string;
  note: string | null;
  published_at: string;
  hidden_at: string | null;
  is_dummy: boolean;
};

/**
 * 貼り付けられたアドレスから、投稿の種類と番号を取り出す。Instagram の投稿でなければ null
 * 例：https://www.instagram.com/p/ABC123/?igsh=... ／ https://instagram.com/reel/ABC123 ／ https://www.instagram.com/会社名/p/ABC123/
 */
export function parseInstagramUrl(input: string): { kind: InstagramKind; shortcode: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "instagram.com" && host !== "www.instagram.com" && host !== "m.instagram.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    const kind = parts[i] === "reels" ? "reel" : parts[i];
    if ((kind === "p" || kind === "reel" || kind === "tv") && /^[A-Za-z0-9_-]{5,64}$/.test(parts[i + 1])) {
      return { kind, shortcode: parts[i + 1] };
    }
  }
  return null;
}

/** 投稿の正式なアドレス */
export function instagramPermalink(kind: InstagramKind, shortcode: string): string {
  return `https://www.instagram.com/${kind}/${shortcode}/`;
}
