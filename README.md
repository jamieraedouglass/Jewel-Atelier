# Jewel Atelier

A private 3D jewellery design studio for jewellers. Upload a stone, build a piece around it, refine it with an AI design consultant, and send the render on WhatsApp.

## What it does

- **Every major piece type.** 9 types and 42 styles:

  | Type | Styles |
  | --- | --- |
  | Rings | Three-stone, solitaire, halo, cluster, navratna, polki cocktail, eternity |
  | Earrings | Stud, drop, hoop (round, oval, paperclip, pearl cluster), huggie, chandelier and pendant drops built part by part (stones, clusters, sprays, strands, briolette fringes, open frames, bows), jhumka, chandbali, ear climber, tassel |
  | Necklaces | Pendant, riviera, station / by the yard, lariat, choker, collar / bib, kundan choker, rani haar, temple, mangalsutra, pearl strand |
  | Bracelets & bangles | Tennis, bangle, kada, cuff, station, charm, beaded |
  | Other | Payal and station anklets, maang tikka, matha patti, nath, nose stud, bajuband, haathphool |

- **Indian materials and making.**
  - 14k, 18k, 22k and 24k gold. Higher karats render warmer and deeper.
  - Platinum and oxidised silver.
  - Polki and rose-cut stones, set closed in gold like kundan work.
  - Meenakari enamel in traditional colours.
  - Pearl and bead fringes.
  - All nine navratna gems, plus 12 more.
  - Trade colour grades for emeralds, rubies, sapphires and spinels (Colombian vs Zambian emerald, Burmese pigeon's blood vs Thai ruby, Kashmir vs Ceylon sapphire…). Each sets the stone's colour, transparency and glow, so a Burmese-type ruby glows from within and a Thai-type one sits darker. A Glow slider fine-tunes any stone. These describe a look; the app never claims where a real stone came from.
- **Indian sizing.** Ring sizes show US and Indian side by side. Bangles use Indian sizes 2-2 to 2-12. Necklace lengths are named, from hasli to opera.
- **Custom motifs (new shapes).** Describe a shape ("peacock with emerald drops"), upload a sketch to trace, or import an SVG from Illustrator or CAD. The motif becomes a gold plate with stones, with millegrain or rope edges and optional enamel. Use it as a ring top, earrings, a pendant, or repeated along a necklace or bracelet. The design chat can draw motifs too. Motifs are flat plates with depth, not fully sculpted 3D forms.
- **Upload a stone.** Add photos or a short phone video. The gem, cut, shape, colour and size are read from them, with a list of what a lab still has to confirm. One click puts it in the piece.
- **Ask the designer.** A chat panel that speaks Western and Indian fine jewellery. It sees the current piece and your style profile: inspiration photos, style icons and notes. It proposes changes you apply with one click.
- **Download and WhatsApp.**
  - **Download image** saves a PNG render.
  - **WhatsApp**, on a phone, shares the render itself with a short description and a link. On a computer it opens WhatsApp with the link.
- **Private by default.** Designs are visible only to you. A link works only after you press Copy link or WhatsApp, and **Turn off link** makes it private again.
- **Name-only accounts.** Sign in with just your name. The same name opens the same account, with its saved designs and style profile, on any device. Set `STUDIO_CODE` to add one shared word for your team, so a stranger can't sign in as you by typing your name.
- **Style profile that tunes the designer.** Preferences (who it's for, style, metals, gems to love and avoid, shapes, scale, occasions, budget, sizes), inspiration photos read once into a written description, style icons and notes, what your own designs show (made and recent pieces count most), and the suggestions you applied or turned down. The chat, recreate-from-photo, motif drawing and stone analysis all use it; suggestions with a gem you avoid never reach you. New designs start in your metal and sizes.
- **Idea → in the workshop → made, and an inventory.** Mark each design's status; made pieces appear on the Inventory page with reference, date, metal and stone weight, cost, price, where the piece is (in stock, reserved, with a client, sold), totals and a CSV download. Each saved design keeps its chat with the designer.
- **Daily AI limit.** Each person gets `AI_DAILY_LIMIT` stone analyses and chat messages per day (default 40), counted in the database.

Stack: Next.js 14 (App Router) · TypeScript · React Three Fiber + drei · Supabase (auth, Postgres, storage) · Anthropic API.

## Setup

1. **Install dependencies.**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at [supabase.com](https://supabase.com).
   - In SQL Editor, run `supabase/schema.sql`. This creates the tables, the security rules, the storage buckets and the daily-limit counter.
   - Copy the **service_role** key from Project Settings → API into `SUPABASE_SERVICE_ROLE_KEY`. The server uses it only to create name-based accounts.
   - In Authentication → Sign In / Providers, turn **off** "Allow new users to sign up". Accounts are then created only through the name sign-in, never by someone calling Supabase directly.
3. **Get an Anthropic API key** at [console.anthropic.com](https://console.anthropic.com). Set a monthly spend limit there too.
4. **Create `.env.local`.**
   ```bash
   cp .env.example .env.local
   ```
   Then fill in the values.
5. **Run it.**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

To deploy, push to Vercel, add the same environment variables there, and set `NEXT_PUBLIC_SITE_URL` to your domain. Then add `https://your-domain/auth/callback` to the Supabase redirect URLs.

## Database updates

A new project only needs `supabase/schema.sql`. An existing project runs these once each, in order, in the Supabase SQL Editor:

1. `supabase/migrations/20261016_refund_ai_call.sql`: failed AI requests are given back.
2. `supabase/migrations/20261016_style_profile_prefs.sql`: style preferences and applied suggestions.
3. `supabase/migrations/20261017_tracking_inventory_feedback.sql`: design status (idea, in the workshop, made), the inventory, turned-down suggestions, the photo read, and saved chats.

The app keeps working before they are run; the features that need them say so.

## How it fits together

| Path | What it does |
| --- | --- |
| `src/lib/design.ts` → `src/lib/design/` | The design model. `vocab` (gems, shapes, metals, sizes), `styles` (each type's styles, the controls each uses, defaults), `schema` (the zod schema every design is validated against), `presets`, `varieties` (trade colour grades), `edit` (patches, style switches, the odd right earring), `dropParts`, `measures` (carat ↔ mm, Indian sizes), `describe`, `showcase`. |
| `src/lib/jewelryModel.ts` → `src/lib/jewelry/` | Builds every piece from building blocks: `stones` and `materials`, repeated `elements` (accents, chains, fringes), `patterns`, `curves` (loops and the worn look), then one builder per type (`ring`, `earrings`, `drops`, `necklace`, `bracelet`, `smallPieces`, `motif`). |
| `src/lib/ringModel.ts` → `src/lib/ring/` | Stone geometry for every cut, the metal tones, the band, and the ring assembly. |
| `src/lib/cache.ts`, `src/lib/glow.ts` | Shared geometry caches (bounded, never freed while a piece uses them) and the lit-from-within look for graded stones. |
| `src/components/RingCanvas.tsx` → `src/components/canvas/` | The 3D view: studio lighting, ray-traced stones, framing, picking parts, true-size cutouts. `canvas/types.ts` holds the shared types without pulling in three.js. |
| `src/components/DesignControls.tsx` → `src/components/controls/` | Controls, one section per file. Only the sections the current style uses are shown. |
| `src/components/Designer.tsx` → `src/components/designer/` | The editor page: undo history, earring pairs, saving and sharing, versions. |
| `src/lib/ai.ts` → `src/lib/ai/` | The AI calls: stone analysis, the design chat, motifs, recreate-from-photo. Every route requires sign-in and counts against the daily limit (charged only once the uploads are readable). |
| `src/app/login/actions.ts` | Name sign-in. Each name maps to a hidden email, and a password derived from `NAME_LOGIN_SECRET`. |
| `src/lib/motifModel.ts`, `src/components/MotifPanel.tsx`, `src/app/api/motif` | Custom motifs: SVG path → extruded plate, plus the AI drawing and tracing endpoint. |
| `supabase/schema.sql` | Tables, row-level security, buckets, the `use_ai_call` limit function. |

To add a style:
1. Add an entry under its type in `STYLES` in `src/lib/design/styles.ts`.
2. Add a branch in the matching builder in `src/lib/jewelry/`.
3. Run `npx vitest -u` to record its snapshot, and check the new snapshot is the only one that changed.

The controls, the landing-page catalogue and the AI chat pick it up automatically.

## Tests

```bash
npm test          # unit tests and geometry snapshots (vitest)
npm run check     # type check, lint and tests together
```

`tests/snapshot.test.ts` builds every style, showcase piece and preset and records a fingerprint of its geometry (mesh and vertex counts, size, and a hash of every vertex). A refactor must leave them all unchanged; when a visual change is intended, update them with `npx vitest -u` and review the diff. `npm run check:render` (see `scripts/render-check.cjs`) still takes real screenshots in a browser.

`npm run check:recreate -- photo.jpg` runs a photo through "From a photo" on your computer (rebuild, then compare with the photo and correct, twice) against `npm run dev`, without signing in, and saves each round next to the photo in `recreate-check/index.html`. It needs `ANTHROPIC_API_KEY` in `.env.local`; the test endpoint it uses only exists under `next dev`.

## Honest limits

- **The renders are for showing pieces, not for manufacture.** Sizes are close, but production still needs CAD (Matrix, Rhino) by a CAD designer.
- **Diamonds and polki are approximations.** They read as bright, mirror-like facets, not true sparkle.
- **Stone analysis from photos has limits.** It can't tell natural from lab-grown, detect treatments, or confirm origin. Use a lab report for that.
