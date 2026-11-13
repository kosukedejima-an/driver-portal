"use client";

import { useEffect } from "react";
import { recordLibraryView } from "../actions";

/** 資料を開いた時点で「見た」と記録する（ボタンを押す必要はない） */
export function RecordView({ itemId }: { itemId: string }) {
  useEffect(() => {
    void recordLibraryView(itemId);
  }, [itemId]);
  return null;
}
