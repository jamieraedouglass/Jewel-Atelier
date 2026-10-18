import { z } from "zod";
import { imageSize, marksToFractions, storageImages, streamReading } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ paths: z.array(z.string()).min(1).max(4), notes: z.string().max(3000).optional() });
const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return json({ error: "Sign in to read a photo." }, 401);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Send 1–4 uploaded photos (notes under 3,000 characters)." }, 400);
  const { paths, notes } = body.data;
  if (paths.some((p) => !p.startsWith(`${user.id}/`))) return json({ error: "Those files aren't yours." }, 403);
  const photos = await storageImages(supabase, "inspiration", paths);
  if (!photos.length) return json({ error: "Couldn't read the uploaded photos." }, 400);
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return json({ error: charge.error }, 429);

  const sizes = photos.map((p) => (p.source.type === "base64" ? imageSize(Buffer.from(p.source.data, "base64")) : null));
  const content = photos.flatMap((p, i) => [{ type: "text" as const, text: `Photo ${i}${sizes[i] ? `: ${sizes[i]!.w} × ${sizes[i]!.h} pixels` : ""}` }, p]);
  const text = [photos.length > 1 ? `${photos.length} photos of the same piece, numbered from 0.` : "One photo (photo 0).", notes ? `Notes from the person: ${notes}` : null].filter(Boolean).join("\n");
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      let last = 0;
      try {
        const result = await streamReading([...content, { type: "text", text }], (snapshot) => {
          const now = Date.now();
          if (now - last > 250) { last = now; send({ type: "snapshot", data: marksToFractions(snapshot, sizes) }); }
        });
        if (!result) { await charge.refund(); send({ type: "error", error: "Couldn't read the piece clearly. Try a closer, brighter photo." }); }
        else send({ type: "done", data: marksToFractions(result, sizes) });
      } catch (e) {
        await charge.refund();
        console.error("Photo reading failed:", e);
        send({ type: "error", error: `Reading the photo didn't work this time. Please try again.${e instanceof Error ? ` (${e.message.slice(0, 140)})` : ""}` });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
