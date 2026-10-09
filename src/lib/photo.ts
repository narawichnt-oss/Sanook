"use client";

import { MAX_PHOTO_CHARS } from "./room-meta";

const SIZE = 128;

/**
 * Turns a picked image into a small square avatar (centre-cropped, 128px) as a
 * data URL. Done in the browser so the full-size photo never leaves the phone.
 */
export async function photoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("เลือกไฟล์รูปภาพนะ");

  let source: ImageBitmap;
  try {
    // Honors EXIF rotation, so phone photos aren't sideways.
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("เปิดรูปนี้ไม่ได้ ลองรูป JPG หรือ PNG แทนนะ");
  }

  const side = Math.min(source.width, source.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  source.close();

  // WebP where the browser can encode it (older Safari falls back to JPEG).
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    let url = canvas.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_PHOTO_CHARS) return url;
  }
  throw new Error("รูปนี้ใหญ่เกินไป ลองรูปอื่นนะ");
}
