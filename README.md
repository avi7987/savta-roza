# סבתא רוזה · Бабушка Роза

A private memorial website for the family, in Hebrew (RTL) and Russian (LTR).

## Run it

```bash
npm install
ADMIN_TOKEN="a-long-private-password" npm run dev
```

- Site: http://localhost:3000
- Share a memory: `/share`
- Moderation: `/admin` (sign in with `ADMIN_TOKEN`, at least 12 characters)

## Where things live

| What | Where |
|---|---|
| All family content (bio chapters, timeline, photos, letters, media) | `src/content/index.ts` |
| Content types and the `placeholder` flag | `src/content/types.ts` |
| Interface text in Hebrew and Russian | `src/i18n/ui.ts` |
| Design tokens (colours, fonts, spacing, shadows) | `src/app/globals.css` |
| Motion presets | `src/lib/motion.ts` |
| Sections | `src/components/sections/*` |
| Upload rules (types, sizes) | `src/lib/limits.ts` |
| Memory API, moderation, file access | `src/app/api/*`, `src/server/*` |

## Adding real content

1. Put optimized photos in `public/photos/` (WebP, about 2000px on the long side) and originals in `public/photos/full/`.
2. In `src/content/index.ts`, set `src` / `full` on the matching photo, give its true `ratio` (width / height), and remove `placeholder: true`.
3. Replace placeholder text in `story`, `milestones`, `notes` and `media` with the family's words, and remove `placeholder: true`.
4. Years appear on the timeline only when `year` is filled in. Nothing is shown that the family has not provided.

## Family tree

- People live in `src/content/family.ts`. Each person only needs `parents` and/or `partnerId`; every relation to Rosa ("granddaughter", "son-in-law", "great-grandson"…) is calculated, in Hebrew and Russian, with the right grammatical gender.
- Empty slots (`placeholder: true`) show their relation until someone fills them in.
- Visitors use "Add yourself to the tree" to join (as a child, partner, sibling or parent of someone) or to fill in / update an existing slot. Requests wait for approval in `/admin` → "עץ המשפחה".
- Photos are linked to people through `people: [...]` on each photo, and through the "Who is in the photos?" picker in the share form. A person's card shows "your photos together with Rosa" and "all photos of …".

## Memories and moderation

- Visitors submit through `/share`. Text is cleaned, files are checked by their actual bytes (not their name), size-limited, and stored under generated names.
- Every submission is stored as **pending**. Nothing is published until a moderator approves it in `/admin`.
- Files of unapproved memories are never served publicly.
- Development storage is the local `data/` folder (git-ignored). For production, implement the same `MemoryStore` interface in `src/server/store.ts` on Cloudflare D1 (records) and R2 (files).

## Preview build

`STATIC_EXPORT=1 NEXT_PUBLIC_STATIC=1 npm run build` produces a static preview without the server routes. In that build the share form shows its confirmation but does not store anything.
