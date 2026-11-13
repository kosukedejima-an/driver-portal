"use client";

import { useEffect } from "react";

/** スマホで横にスクロールするタブのうち、選んでいるタブが見える位置まで動かす */
export function ScrollToCurrentTab() {
  useEffect(() => {
    document.querySelector("[data-current-tab]")?.scrollIntoView({ block: "nearest", inline: "center" });
  });
  return null;
}
