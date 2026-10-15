# Ring Atelier

Design a ring around your own gemstone, in 3D, with friends.

- **3D configurator.** Pick the centre stone (gem, cabochon or faceted, shape, size, colour), side stones (half-moon, trapezoid, baguette, round), setting (double claw, six claw, four claw, bezel), setting height, rose-cut gallery accents, metal, band finish and ring size.
- **Upload your stone.** Add photos or a short phone video. Frames are pulled from the video in the browser. Claude identifies the shape, cut and colour, estimates size from a scale reference or the carat weight, and lists what a lab still needs to confirm. One click puts it in the ring.
- **Ask the designer.** A chat panel that sees the current ring and your style profile (inspiration photos, style icons, notes). It answers questions and proposes specific changes you can apply with one click.
- **Accounts, saved rings, share links.** Magic-link sign-in. Each ring gets a public page at `/d/<id>` that anyone can view and copy into their own account.

Stack: Next.js 14 (App Router) · TypeScript · React Three Fiber + drei · Supabase (auth, Postgres, storage) · Claude API.

## Setup

1. **Install dependencies.**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at [supabase.com](https://supabase.com). It's free for this size.
   - Go to SQL Editor, paste `supabase/schema.sql`, and run it. This creates the tables, the row-level security rules and the three storage buckets.
   - Go to Authentication → URL Configuration and set **Site URL** to `http://localhost:3000`. Add `http://localhost:3000/auth/callback`, plus your production URL's `/auth/callback`, to **Redirect URLs**.
3. **Get a Claude API key** at [console.anthropic.com](https://console.anthropic.com).
4. **Create `.env.local`.**
   ```bash
   cp .env.example .env.local
   ```
   Then fill in the Supabase URL, the anon key and `ANTHROPIC_API_KEY`.
5. **Run it.**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

### Deploying

Push the repo to Vercel, add the same environment variables there, and set `NEXT_PUBLIC_SITE_URL` to your domain. Then add `https://your-domain/auth/callback` to the Supabase redirect URLs.

## How it fits together

| Path | What it does |
| --- | --- |
| `src/lib/design.ts` | The `Design` schema (zod). This JSON object is rendered, saved, sent to Claude and patched by Claude. It also holds the carat ↔ millimetre estimates. |
| `src/lib/ringModel.ts` | Builds the three.js ring from a `Design`: stone outlines, cabochon and faceted geometry, claws, gallery and band. |
| `src/components/RingCanvas.tsx` | R3F canvas, studio lighting, camera views, thumbnail snapshot. |
| `src/components/Designer.tsx` | Designer page: canvas plus the Design, Upload stone and Ask the designer tabs. |
| `src/app/api/analyze-stone` | Sends uploaded stone images to Claude and gets a structured reading back through forced tool use. |
| `src/app/api/chat` | Design chat. Your style profile is cached at the start of the conversation, and Claude proposes changes through the `propose_design` tool. |
| `src/app/actions.ts` | Server actions: save, copy and delete rings; save the style profile. |
| `supabase/schema.sql` | Tables, RLS policies and storage buckets. |

### Privacy

- Stone photos and inspiration photos go in private buckets. Only their owner can read them.
- Ring thumbnails are public, so share links can show a preview.
- The Claude API key stays on the server.
- Every AI call requires a signed-in user, so strangers can't run up your bill.

### Ideas for next steps

- Stream chat replies.
- Let friends comment on a shared ring.
- Add more side-stone layouts, such as three-stone graduated pavé.
- Use an HDR studio environment for even more realistic diamonds.
- Export a spec sheet for the jeweller.
