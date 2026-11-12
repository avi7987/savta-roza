import "server-only";
import { profile } from "@/content";
import type { CategoryId } from "@/content/types";
import { cleanDate, thisYear, validYear, type PhotoDate } from "@/lib/photoDate";

/*
  Estimating when a photo was taken, with a vision model on Cloudflare Workers AI
  (free daily allowance; on the Workers Free plan it stops for the day rather than charging).
  The model's answer is treated as untrusted data: only numbers in a sane range and a short
  clue text are kept, and the family can always correct the result.
*/

const MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const CATEGORIES: CategoryId[] = ["family", "childhood", "celebrations", "travel", "moments", "grandchildren"];

type Ai = { run(model: string, input: unknown): Promise<unknown> };

async function binding(): Promise<Ai | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { AI?: Ai }).AI;
  } catch {
    return undefined;
  }
}

const base64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

export type Estimate = { date: PhotoDate; reproduction: boolean; category?: CategoryId };

export async function estimatePhoto(jpeg: Uint8Array, opts: { rosaInPhoto?: boolean } = {}): Promise<Estimate | null> {
  const ai = await binding();
  if (!ai || jpeg.byteLength > 2_500_000) return null;
  const born = profile.birthYear;
  const rosa =
    opts.rosaInPhoto && born
      ? `The photo includes Rosa, a woman born in ${born}. If you can tell which person she is, estimate her age in the photo as "rosa_age".`
      : `Set "rosa_age" to null.`;
  const prompt = `You help a family date old photographs of their grandmother Rosa. Today is ${thisYear()}.
Estimate when this picture was taken from evidence such as: black-and-white vs colour, sepia or faded colour film, print borders and paper texture, photo format, clothing and hairstyles, glasses, furniture, cars, phones, signs, and image quality.
If the picture is a reproduction of an old printed photo (a scan, or a phone photo of a print, album page or frame), set "reproduction": true and date the ORIGINAL photo.
${rosa}
Pick a "category" from: ${CATEGORIES.join(", ")} (family gatherings = family, a young child = childhood, holidays/weddings/birthdays = celebrations, outdoors/trips = travel, grandchildren with an older woman = grandchildren, otherwise moments).
Reply with ONLY a JSON object, no other text:
{"year_from": <int>, "year_to": <int>, "best_year": <int>, "reproduction": <true|false>, "rosa_age": <int|null>, "category": "<category>", "clues_he": "<one short Hebrew sentence with the main clues>"}`;

  try {
    const res = (await ai.run(MODEL, {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64(jpeg)}` } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    })) as { response?: string | object };
    const text = typeof res?.response === "string" ? res.response : JSON.stringify(res?.response ?? "");
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    const o = JSON.parse(json) as Record<string, unknown>;

    let from = validYear(o.year_from);
    let to = validYear(o.year_to);
    let best = validYear(o.best_year);
    const age = Number(o.rosa_age);
    // her apparent age is the strongest clue when we know when she was born
    if (born && Number.isFinite(age) && age > 0 && age < 110) {
      best = validYear(born + Math.round(age)) ?? best;
      if (best) {
        from = Math.max(born, best - 4);
        to = Math.min(thisYear(), best + 4);
      }
    }
    if (!from && best) from = best - 5;
    if (!to && best) to = best + 5;
    const date = cleanDate({ from, to, clues: typeof o.clues_he === "string" ? o.clues_he : undefined }, "ai");
    if (!date) return null;
    const category = CATEGORIES.includes(o.category as CategoryId) ? (o.category as CategoryId) : undefined;
    return { date, reproduction: o.reproduction === true, category };
  } catch (e) {
    console.warn("[vision] estimate failed", e);
    return null;
  }
}

/** Combine what we know: the family's word, then the file's own date (unless it is a scan), then the estimate. */
export function chooseDate(user: PhotoDate | undefined, exif: PhotoDate | undefined, est: Estimate | null): PhotoDate | undefined {
  if (user) return user;
  if (exif && !(est?.reproduction && est.date)) return exif;
  return est?.date ?? exif;
}
