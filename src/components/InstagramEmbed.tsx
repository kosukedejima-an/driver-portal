"use client";

import { useEffect, useRef, useState } from "react";
import { instagramPermalink, type InstagramKind } from "@/lib/instagram";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let scriptLoading: Promise<void> | null = null;

/** Instagram の埋め込み用の仕組み（embed.js）を1回だけ読み込む */
function loadEmbedScript(): Promise<void> {
  if (window.instgrm) return Promise.resolve();
  if (!scriptLoading) {
    scriptLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://www.instagram.com/embed.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptLoading = null;
        reject(new Error("embed.js"));
      };
      document.body.appendChild(s);
    });
  }
  return scriptLoading;
}

/**
 * Instagram の投稿をそのまま表示する。画面に近づいてから読み込む（タイムラインを重くしないため）。
 * 中身は Instagram の仕組みが書き換えるので、React には触らせない入れ物の中に作る。
 */
export function InstagramEmbed({ kind, shortcode }: { kind: InstagramKind; shortcode: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!near || !el) return;
    const url = instagramPermalink(kind, shortcode);
    const quote = document.createElement("blockquote");
    quote.className = "instagram-media";
    quote.setAttribute("data-instgrm-permalink", `${url}?utm_source=ig_embed`);
    quote.setAttribute("data-instgrm-version", "14");
    quote.setAttribute("data-instgrm-captioned", "");
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Instagramの投稿を読み込み中…";
    quote.appendChild(link);
    el.replaceChildren(quote);
    let cancelled = false;
    loadEmbedScript()
      .then(() => {
        if (!cancelled) window.instgrm?.Embeds.process();
      })
      .catch(() => {
        if (cancelled) return;
        el.replaceChildren();
        setFailed(true);
      });
    return () => {
      cancelled = true;
      el.replaceChildren();
    };
  }, [near, kind, shortcode]);

  return (
    <div>
      <div ref={box} className={failed ? "" : "instagram-embed min-h-80"} />
      {failed && <p className="px-4 py-3 text-base text-gray-600">Instagramの投稿を表示できませんでした。下の「Instagramで開く」から見られます。</p>}
    </div>
  );
}
