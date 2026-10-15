# Jewel Atelier

A private 3D jewellery design studio for jewellers. Upload a stone, build a piece around it, refine it with an AI design consultant, and send the render on WhatsApp.

## What it does

- **Every major piece type.** 9 types and 42 styles:

  | Type | Styles |
  | --- | --- |
  | Rings | Three-stone, solitaire, halo, cluster, navratna, polki cocktail, eternity |
  | Earrings | Stud, drop, hoop, huggie, chandelier, jhumka, chandbali, ear climber, tassel |
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
- **Indian sizing.** Ring sizes show US and Indian side by side. Bangles use Indian sizes 2-2 to 2-12. Necklace lengths are named, from hasli to opera.
- **Custom motifs (new shapes).** Describe a shape ("peacock with emerald drops"), upload a sketch for Claude to trace, or import an SVG from Illustrator or CAD. The motif becomes a gold plate with stones, with millegrain or rope edges and optional enamel. Use it as a ring top, earrings, a pendant, or repeated along a necklace or bracelet. The design chat can draw motifs too. Motifs are flat plates with depth, not fully sculpted 3D forms.
- **Upload a stone.** Add photos or a short phone video. Claude reads the gem, cut, shape, colour and size, and lists what a lab still has to confirm. One click puts it in the piece.
- **Ask the designer.** A chat panel that speaks Western and Indian fine jewellery. It sees the current piece and your style profile: inspiration photos, style icons and notes. It proposes changes you apply with one click.
- **Download and WhatsApp.**
  - **Download image** saves a PNG render.
  - **WhatsApp**, on a phone, shares the render itself with a short description and a link. On a computer it opens WhatsApp with the link.
- **Private by default.** Designs are visible only to you. A link works only after you press Copy link or WhatsApp, and **Turn off link** makes it private again.
- **Name-only accounts.** Sign in with just your name. The same name opens the same account, with its saved designs and style profile, on any device. Set `STUDIO_CODE` to add one shared word for your team, so a stranger can't sign in as you by typing your name.
- **Daily AI limit.** Each person gets `AI_DAILY_LIMIT` stone analyses and chat messages per day (default 40), counted in the database.

Stack: Next.js 14 (App Router) · TypeScript · React Three Fiber + drei · Supabase (auth, Postgres, storage) · Claude API.

## Setup

1. **Install dependencies.**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at [supabase.com](https://supabase.com).
   - In SQL Editor, run `supabase/schema.sql`. This creates the tables, the security rules, the storage buckets and the daily-limit counter.
   - Copy the **service_role** key from Project Settings → API into `SUPABASE_SERVICE_ROLE_KEY`. The server uses it only to create name-based accounts.
   - In Authentication → Sign In / Providers, turn **off** "Allow new users to sign up". Accounts are then created only through the name sign-in, never by someone calling Supabase directly.
3. **Get a Claude API key** at [console.anthropic.com](https://console.anthropic.com). Set a monthly spend limit there too.
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

## How it fits together

| Path | What it does |
| --- | --- |
| `src/lib/design.ts` | The design schema: types, styles (each lists the controls it uses and its defaults), gems, metals, karat, Indian sizes, carat ↔ mm estimates and showcase pieces. |
| `src/lib/jewelryModel.ts` | Builds every non-ring piece from building blocks: set stones, instanced accents, halos, kundan flowers, chains, bead strands, fringes, jhumka bells, chandbali crescents and temple coins. |
| `src/lib/ringModel.ts` | Stone geometry for every cut, plus the ring itself: shank, gallery, claws, side stones. |
| `src/components/RingCanvas.tsx` | Canvas, studio lighting, automatic framing for any size of piece, image snapshots. |
| `src/components/DesignControls.tsx` | Controls. Only the ones the current style uses are shown. |
| `src/app/api/analyze-stone`, `src/app/api/chat` | The Claude calls. Both require sign-in and count against the daily limit. |
| `src/app/login/actions.ts` | Name sign-in. Each name maps to a hidden email, and a password derived from `NAME_LOGIN_SECRET`. |
| `src/lib/motifModel.ts`, `src/components/MotifPanel.tsx`, `src/app/api/motif` | Custom motifs: SVG path → extruded plate, plus the AI drawing and tracing endpoint. |
| `supabase/schema.sql` | Tables, row-level security, buckets, the `use_ai_call` limit function. |

To add a style:
1. Add an entry under its type in `STYLES` in `design.ts`.
2. Add a branch in the matching builder in `jewelryModel.ts`.

The controls, the landing-page catalogue and the AI chat pick it up automatically.

## Honest limits

- **The renders are for showing pieces, not for manufacture.** Sizes are close, but production still needs CAD (Matrix, Rhino) by a CAD designer.
- **Diamonds and polki are approximations.** They read as bright, mirror-like facets, not true sparkle.
- **Stone analysis from photos has limits.** It can't tell natural from lab-grown, detect treatments, or confirm origin. Use a lab report for that.
