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

- The tree starts with Rosa and her husband only (`src/content/family.ts`) and grows from what the family adds. A ring appears for each generation as soon as someone is in it.
- "Add to the tree" asks the relationship to Rosa first (child, grandchild, great-grandchild, partner, sibling, parent), then through whom. If a grandchild's parent is not in the tree yet, choose "not in the tree yet": a slot for the parent is created (named or empty) so the ring of children appears too. A path preview shows where the person will land.
- "+" next to anyone in the tree (and in each person's card) opens the form already set to "child of …" or "partner of …".
- Relations ("granddaughter", "son-in-law", "great-grandson"…) are calculated in Hebrew and Russian with the right grammatical gender.
- Requests wait for approval in `/admin` → "עץ המשפחה". Approving a person also approves the pending people they hang from. Visitors see their own additions right away, marked "waiting for approval".
- Photos are linked to people through `people: [...]` on each photo and the "Who is in the photos?" picker in the share form; a person's card shows "your photos together with Rosa" and "all photos of …".

## Memories and moderation

- Visitors submit through `/share`. Text is cleaned, files are checked by their actual bytes (not their name), size-limited, and stored under generated names.
- Every submission is stored as **pending**. Nothing is published until a moderator approves it in `/admin`.
- Files of unapproved memories are never served publicly.
- Storage is chosen automatically: on Cloudflare, records go to D1 (`records` table, see `migrations/`) and files to R2 (`savta-roza-files`); in development they go to the local `data/` folder (git-ignored).

## Storage limit and email alerts

- New files are refused once uploads total **8 GB** (Cloudflare R2's free tier is 10 GB); text-only memories still go through. Change with the `STORAGE_CAP_GB` variable (`STORAGE_WARN_GB`, default 7, sets the early warning).
- Files of rejected memories and family requests are deleted.
- At 7 GB and at 8 GB the owner gets an email (at most one of each per day) through [Resend](https://resend.com). Set two Worker secrets: `RESEND_API_KEY` and `ALERT_EMAIL` (the address the Resend account was opened with).

## Deploying to Cloudflare

The Worker `savta-roza-1` is connected to this GitHub repository (Workers Builds): every push to `main` builds and deploys automatically. `wrangler deploy` runs the OpenNext build first (see `build` in `wrangler.jsonc`). To deploy by hand:

```bash
npx opennextjs-cloudflare build
```

```bash
npx wrangler d1 migrations apply savta-roza --remote
```

```bash
npx wrangler secret put ADMIN_TOKEN
```

```bash
npx opennextjs-cloudflare deploy
```

Bindings live in `wrangler.jsonc`: `DB` (D1 database `savta-roza`) and `FILES` (R2 bucket `savta-roza-files`). For local testing in the Cloudflare runtime, put `ADMIN_TOKEN=...` in `.dev.vars` and run `npx wrangler dev`.

## Preview build

`STATIC_EXPORT=1 NEXT_PUBLIC_STATIC=1 npm run build` produces a static preview without the server routes. In that build the share form shows its confirmation but does not store anything.
