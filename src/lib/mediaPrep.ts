"use client";

/*
  Everything we can learn about a photo or video in the browser before it is sent:
  the date stored in the file, its proportions, and a small preview image. The preview
  keeps the gallery fast and is what the date-estimating model looks at.
*/

export type Prepared = { date?: string; width?: number; height?: number; thumb?: Blob };

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

const toJpeg = (canvas: HTMLCanvasElement) => new Promise<Blob | undefined>((res) => canvas.toBlob((b) => res(b ?? undefined), "image/jpeg", 0.82));

async function imageThumb(file: File) {
  try {
    const bmp = await createImageBitmap(file);
    const [w, h] = scaleTo(bmp.width, bmp.height);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    return { width: bmp.width, height: bmp.height, thumb: await toJpeg(c) };
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
    return { width: v.videoWidth, height: v.videoHeight, thumb: await toJpeg(c) };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepare(file: File): Promise<Prepared> {
  if (file.type.startsWith("image/")) {
    const [date, t] = await Promise.all([exifDate(file).catch(() => undefined), imageThumb(file)]);
    return { date, ...t };
  }
  if (file.type.startsWith("video/")) {
    const [date, t] = await Promise.all([videoDate(file).catch(() => undefined), videoThumb(file)]);
    return { date, ...t };
  }
  return {};
}

/** A small JPEG from an already-loaded image (used by the moderation page for older uploads). */
export async function thumbFromBlob(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const [w, h] = scaleTo(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return { width: bmp.width, height: bmp.height, thumb: await toJpeg(c) };
}
