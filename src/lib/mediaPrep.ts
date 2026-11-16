"use client";

/*
  Everything we can learn about a photo or video in the browser before it is sent:
  the date stored in the file, its proportions, and a small preview image. The preview
  keeps the gallery fast and is what the date-estimating model looks at.
*/

export type Prepared = { date?: string; nameDate?: string; width?: number; height?: number; thumb?: Blob; sha?: string; phash?: string; sound?: Blob };

/** how much of a video's sound is kept for writing down what is said (16 kHz mono WAV: about 15 MB) */
const SOUND_RATE = 16000;
const SOUND_SECONDS = 8 * 60;

/**
 * A video's soundtrack as a small mono WAV, so the site can write down what is said in it.
 * Done here in the browser, for free; if the browser cannot read the sound (or there is none,
 * or it is silent), there is simply no soundtrack and nothing else changes.
 */
export async function soundOf(file: File): Promise<Blob | undefined> {
  if (typeof OfflineAudioContext === "undefined" || file.size > 200 * 1024 * 1024) return;
  const ctx = new OfflineAudioContext(1, SOUND_RATE, SOUND_RATE);
  const audio = await ctx.decodeAudioData(await file.arrayBuffer());
  const n = Math.min(audio.length, SOUND_RATE * SOUND_SECONDS);
  if (n < SOUND_RATE) return; // under a second
  const mono = new Float32Array(n);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / audio.numberOfChannels;
  }
  let sum = 0;
  for (let i = 0; i < n; i += 16) sum += mono[i] * mono[i];
  if (Math.sqrt(sum / (n / 16)) < 0.003) return; // silent
  // 16-bit PCM WAV
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const text = (at: number, t: string) => [...t].forEach((ch, i) => out.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  out.setUint32(4, 36 + n * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, SOUND_RATE, true);
  out.setUint32(28, SOUND_RATE * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  text(36, "data");
  out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, mono[i])) * 0x7fff, true);
  return new Blob([out.buffer], { type: "audio/wav" });
}

/** a date in the file name: IMG_20120514_..., IMG-20120514-WA0001, 2012-05-14 ..., PXL_20120514... */
export function dateFromName(name: string): string | undefined {
  const m = name.match(/(?<!\d)((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)/);
  if (!m) return undefined;
  const y = Number(m[1]);
  return y >= 1990 && y <= new Date().getFullYear() ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

const THUMB_EDGE = 720;

/* ---------- JPEG EXIF: DateTimeOriginal (or DateTime) ---------- */
async function exifDate(file: File): Promise<string | undefined> {
  const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return undefined;
  let off = 2;
  while (off + 4 < buf.byteLength) {
    const marker = buf.getUint16(off);
    const len = buf.getUint16(off + 2);
    if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) return readTiff(buf, off + 10);
    if ((marker & 0xff00) !== 0xff00) break;
    off += 2 + len;
  }
  return undefined;
}

function readTiff(v: DataView, start: number): string | undefined {
  const little = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(start + o, little);
  const u32 = (o: number) => v.getUint32(start + o, little);
  const ascii = (o: number, n: number) => {
    let s = "";
    for (let i = 0; i < n && start + o + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(start + o + i));
    return s;
  };
  const scan = (ifd: number) => {
    const out: Record<number, number> = {};
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      out[u16(e)] = e;
    }
    return out;
  };
  try {
    const ifd0 = scan(u32(4));
    let raw: string | undefined;
    if (ifd0[0x8769]) {
      const exif = scan(u32(ifd0[0x8769] + 8));
      const e = exif[0x9003] ?? exif[0x9004];
      if (e) raw = ascii(u32(e + 8), 19);
    }
    if (!raw && ifd0[0x0132]) raw = ascii(u32(ifd0[0x0132] + 8), 19);
    const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2})/);
    return m && m[1] !== "0000" ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
  } catch {
    return undefined;
  }
}

/* ---------- MP4 / MOV: creation time in the 'mvhd' box ---------- */
async function videoDate(file: File): Promise<string | undefined> {
  const chunks = [file.slice(0, 4 * 1024 * 1024), file.slice(Math.max(0, file.size - 4 * 1024 * 1024))];
  for (const c of chunks) {
    const v = new DataView(await c.arrayBuffer());
    for (let i = 4; i + 24 < v.byteLength; i++) {
      // 'mvhd'
      if (v.getUint32(i) !== 0x6d766864) continue;
      const version = v.getUint8(i + 4);
      const secs = version === 1 ? Number(v.getBigUint64(i + 8)) : v.getUint32(i + 8);
      const ms = (secs - 2082844800) * 1000; // seconds since 1904
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      if (y >= 1990 && y <= new Date().getFullYear()) return d.toISOString().slice(0, 10);
      return undefined;
    }
  }
  return undefined;
}

function scaleTo(w: number, h: number) {
  const k = Math.min(1, THUMB_EDGE / Math.max(w, h));
  return [Math.round(w * k), Math.round(h * k)];
}

/** exact-file fingerprint */
export async function sha256(blob: Blob) {
  const d = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** what-it-looks-like fingerprint: 9x8 grey, compare neighbours → 64 bits as 16 hex digits */
function dhash(src: CanvasImageSource) {
  const c = document.createElement("canvas");
  c.width = 9;
  c.height = 8;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, 9, 8);
  const px = g.getImageData(0, 0, 9, 8).data;
  const lum = (x: number, y: number) => {
    const i = (y * 9 + x) * 4;
    return px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  };
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += lum(x, y) > lum(x + 1, y) ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

const toJpeg = (canvas: HTMLCanvasElement) => new Promise<Blob | undefined>((res) => canvas.toBlob((b) => res(b ?? undefined), "image/jpeg", 0.82));

async function imageThumb(file: File) {
  try {
    const bmp = await createImageBitmap(file);
    const [w, h] = scaleTo(bmp.width, bmp.height);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    return { width: bmp.width, height: bmp.height, thumb: await toJpeg(c), phash: dhash(c) };
  } catch {
    return {}; // e.g. HEIC in browsers that cannot decode it
  }
}

async function videoThumb(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res();
      v.onerror = () => rej();
      setTimeout(rej, 8000);
    });
    v.currentTime = Math.min(1, (v.duration || 2) / 3);
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      setTimeout(res, 3000);
    });
    const [w, h] = scaleTo(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(v, 0, 0, w, h);
    return { width: v.videoWidth, height: v.videoHeight, thumb: await toJpeg(c), phash: dhash(c) };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepare(file: File): Promise<Prepared> {
  const sha = await sha256(file).catch(() => undefined);
  const nameDate = dateFromName(file.name);
  if (file.type.startsWith("image/")) {
    const [date, t] = await Promise.all([exifDate(file).catch(() => undefined), imageThumb(file)]);
    return { date, nameDate, sha, ...t };
  }
  if (file.type.startsWith("video/")) {
    const [date, t, sound] = await Promise.all([videoDate(file).catch(() => undefined), videoThumb(file), soundOf(file).catch(() => undefined)]);
    return { date, nameDate, sha, sound, ...t };
  }
  return { sha, nameDate };
}

/** A small JPEG from an already-loaded image (used by the moderation page for older uploads). */
export async function thumbFromBlob(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const [w, h] = scaleTo(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return { width: bmp.width, height: bmp.height, thumb: await toJpeg(c), phash: dhash(c) };
}

/* ---------- making files smaller before they are sent (the free storage holds far more) ---------- */

/** the long side of a photo on the site: sharp on any screen, and fine for a normal print */
const PHOTO_MAX = 2560;

/**
 * A photo, resized and saved as a good-quality JPEG. Turned the right way up (as the camera meant it).
 * The original is returned when the browser cannot open it (e.g. HEIC outside Safari) or when the
 * smaller copy would not be smaller.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, PHOTO_MAX / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size * 0.9) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** videos are made at most this tall/wide on their shorter side (720p): clear, and about 5 times smaller */
const VIDEO_SHORT_SIDE = 720;

/**
 * A video re-made in the browser as a smaller MP4 (H.264 + AAC, 720p). Returns the original when the
 * browser cannot do it (older devices) or when it would not save space. onProgress gets 0..1.
 */
export async function shrinkVideo(file: File, onProgress?: (p: number) => void): Promise<File> {
  if (!file.type.startsWith("video/") || typeof VideoEncoder === "undefined") return file;
  try {
    const mb = await import("mediabunny");
    if (!(await mb.canEncodeVideo("avc"))) return file;
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: (track) => {
        const w = track.displayWidth, h = track.displayHeight;
        const short = Math.min(w, h);
        const k = short > VIDEO_SHORT_SIDE ? VIDEO_SHORT_SIDE / short : 1;
        // even sizes, as video encoders want
        const even = (x: number) => Math.max(2, Math.round((x * k) / 2) * 2);
        return { codec: "avc", width: even(w), height: even(h), fit: "fill", quality: mb.QUALITY_MEDIUM };
      },
      // the sound is copied as it is when it can be (no re-encoding, no loss); never left out
      audio: {},
    });
    if (!conversion.isValid || conversion.discardedTracks.some((d) => d.track.type === "audio")) return file;
    conversion.onProgress = (p) => onProgress?.(p);
    await conversion.execute();
    const buf = target.buffer;
    if (!buf || buf.byteLength >= file.size * 0.9) return file;
    return new File([buf], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4", lastModified: file.lastModified });
  } catch (e) {
    console.warn("[video] kept the original:", e);
    return file;
  }
}
