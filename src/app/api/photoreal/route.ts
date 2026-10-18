import { NextResponse } from "next/server";
import { z } from "zod";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({ render: z.string().startsWith("data:image/").max(6_000_000), design: z.unknown(), setting: z.enum(["dark", "light", "hand"]).default("dark") });

const LIGHT = { studio: "soft white studio light", daylight: "natural daylight from a window", warm: "warm indoor lamp light" } as const;
const SCENE = { dark: "on dark charcoal velvet", light: "on a soft ivory background", hand: "worn on an elegant hand" } as const;

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to make a photo-style image." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Photo-style images need an OpenAI API key. Add OPENAI_API_KEY in Vercel → Settings → Environment Variables, then redeploy." }, { status: 501 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const d = normalizeDesign(body.data.design);
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });

  const prompt = [
    "Turn this 3D render into a professional photograph of the very same piece of fine jewellery.",
    `The piece: ${describeDesign(d)}.`,
    "Keep the design exactly as it is: the same outline and proportions, the same number, sizes, shapes, colours and positions of every stone, the same metal colour and the same viewing angle. Do not add, remove, move or redesign anything.",
    "Only make the materials real: faceted stones with true brilliance and fire, polished translucent cabochons, real polished metal, crisp milgrain beads and prongs.",
    `${LIGHT[d.options.lighting]}, photographed ${SCENE[body.data.setting]}, macro lens, sharp focus, soft natural shadows, high-end jewellery catalogue photograph.`,
  ].join(" ");

  try {
    const [, mime, b64] = body.data.render.match(/^data:(image\/\w+);base64,(.*)$/) ?? [];
    if (!b64) throw new Error("bad image");
    const form = new FormData();
    form.append("model", process.env.IMAGE_MODEL || "gpt-image-1");
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "high");
    form.append("image", new Blob([Buffer.from(b64, "base64")], { type: mime }), mime === "image/png" ? "render.png" : "render.jpg");
    const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
    const json = await res.json().catch(() => null);
    const out = json?.data?.[0]?.b64_json;
    if (!res.ok || !out) {
      await charge.refund();
      return NextResponse.json({ error: json?.error?.message ? `The image service said: ${json.error.message}` : "Couldn't make the image." }, { status: 502 });
    }
    return NextResponse.json({ image: `data:image/png;base64,${out}` });
  } catch (e) {
    await charge.refund();
    console.error("photoreal failed", e);
    return NextResponse.json({ error: "Couldn't make the image." }, { status: 500 });
  }
}
