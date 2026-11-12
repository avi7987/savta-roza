import "server-only";
import type { MediaKind } from "@/lib/limits";

/**
 * Identify a file from its first bytes instead of trusting the browser-supplied type or name.
 * Returns the media kind and a safe extension, or null for anything else.
 */
export function sniff(buf: Uint8Array): { kind: MediaKind; ext: string } | null {
  const b = (i: number) => buf[i];
  const ascii = (start: number, len: number) => String.fromCharCode(...buf.slice(start, start + len));

  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { kind: "image", ext: "jpg" };
  if (b(0) === 0x89 && ascii(1, 3) === "PNG") return { kind: "image", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { kind: "image", ext: "webp" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return { kind: "audio", ext: "wav" };
  if (ascii(0, 4) === "OggS") return { kind: "audio", ext: "ogg" };
  if (ascii(0, 3) === "ID3" || (b(0) === 0xff && (b(1) & 0xe0) === 0xe0)) return { kind: "audio", ext: "mp3" };
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return { kind: "video", ext: "webm" };

  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand)) return { kind: "image", ext: "heic" };
    if (["M4A ", "M4B "].includes(brand)) return { kind: "audio", ext: "m4a" };
    if (brand === "qt  ") return { kind: "video", ext: "mov" };
    return { kind: "video", ext: "mp4" };
  }
  return null;
}
