# shared/ui: the "Sheet set" design system

Source of truth for the UI pieces reused by 1A, 1B and 1C. Design rules: `../DESIGN-GUIDE.md`.

## How apps use it
Apps **vendor** these files with a sync script (`scripts/sync-shared.mjs` in each app, chained into
`predev`, `pretest`, `prebuild`). Copies are generated: **do not edit them in the app**. Edit here, then re-run
`npm run sync-shared`. (Vendoring avoids Turbopack problems with modules outside the app root.)

| source | lands in the app at |
|---|---|
| `tokens.css` | `components/shared/tokens.css` (import it from `app/globals.css` after `@import "tailwindcss"`) |
| `components/*.tsx` | `components/shared/*.tsx` |
| `lib/**` | `lib/shared/**` |

Import paths inside the shared files assume that layout: `@/components/shared/*`, `@/lib/shared/*`,
`@/components/ui/*` and `@/lib/utils` (the app provides the last two).

## Contents
- `tokens.css`: tokens, Tailwind `@theme inline` mapping, shadcn variable mapping, blueprint dark theme, plan grid,
  focus ring, reduced-motion rules. Needs `tw-animate-css`/`shadcn/tailwind.css` imported by the app's globals.css.
- `components/ref-tag.tsx` (RefTag), `provenance-tag.tsx`, `confidence-mark.tsx`, `sheet.tsx` (title block + DRAFT
  stamp; `drawn` and `siteLabel` props), `theme-toggle.tsx`, `step-rail.tsx`, `source-pane.tsx`.
- `lib/zr/locate.ts` (quote locator), `lib/zr/types.ts`, `lib/zr/source-doc.ts` (adapters), `lib/zr/locate.test.ts`.

### SourcePane
`<SourcePane open citation onClose />` with `citation: SourceCitation` (`{section, quote, anchor?, refLabel?, ...}`;
1B's `Citation` is assignable). Default behaviour is 1B's: `GET /api/clause?id=&quote=` returning `{ section, location? }`.
For chunk documents pass `loader(citation, signal) => { document, location? }` or a ready `document`.
`SourceDocument = { id, title, breadcrumbs, lastAmended?, versionLabel?, url?, sample?, blocks: ({anchor, label?, text} | {table})[] }`.
Pass a stable `loader`. If `location` is omitted the pane runs the locator itself.

## Required dependencies (app provides)
- npm: `react`, `react-dom`, `motion` (`motion/react`), `lucide-react`, `radix-ui`, `clsx`, `tailwind-merge`,
  `tailwindcss` 4, `tw-animate-css`, `shadcn`.
- `@/lib/utils` exporting `cn`.
- shadcn components (radix base): `button`, `hover-card`, `tooltip`. The app root layout must mount `TooltipProvider`.
- Fonts via `next/font/google` as CSS variables `--font-plex-sans`, `--font-plex-mono`, `--font-plex-condensed`.
- An inline script in `<head>` that applies the stored theme before first paint (see 1B/1A `app/layout.tsx`).
