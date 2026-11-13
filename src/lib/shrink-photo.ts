"use client";

/**
 * スマホの写真は大きいため、送る前に長い辺を maxSize px（ふだんは1600px）まで縮小する（縮小できない形式はそのまま）。
 * 報告書を読み取るときは、細かい字がつぶれないよう大きめ（2400px）にする
 */
export async function shrinkPhoto(file: File, maxSize = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
