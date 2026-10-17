"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { isStudioAdmin } from "@/lib/studio/admin";
import { CreateLinkSchema, normalizeAllow, type CreateLink } from "@/lib/studio/links";
import { cleanPricing, normalizePricing, type Pricing } from "@/lib/studio/pricing";
import { createLink, designsByIds, linkById, updateLink } from "@/lib/studio/server";

async function admin() {
  const { user } = await requireUser();
  return user && isStudioAdmin(user) ? user : null;
}

/** send designs to a client: a new private link (the client needs no account) */
export async function createClientLink(input: CreateLink, prices?: Pricing): Promise<{ url?: string; id?: string; error?: string }> {
  const user = await admin();
  if (!user) return { error: "Only the studio's master accounts can send designs to clients." };
  const parsed = CreateLinkSchema.safeParse(input);
  if (!parsed.success) return { error: "Add the client's name and at least one piece." };
  // check the chosen pieces themselves, however old (not just the most recent ones)
  const bases = await designsByIds(parsed.data.designIds);
  if (parsed.data.designIds.some((id) => !bases[id])) return { error: "One of those pieces no longer exists." };
  try {
    // prices only for versions the client can actually reach on this link
    const pricing = cleanPricing(normalizePricing(prices), bases, parsed.data.allow);
    const { id, token } = await createLink(user.id, { ...parsed.data, pricing });
    revalidatePath("/studio");
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    return { id, url: `${site}/c/${token}` };
  } catch (e) {
    console.error("create link failed:", e);
    return { error: "Couldn't create the link: has supabase/migrations/20261018_client_links.sql been run?" };
  }
}

/** turn a link off (the client sees that it has closed; their changes are kept), or back on */
export async function setLinkRevoked(id: string, revoked: boolean): Promise<{ error?: string }> {
  if (!(await admin())) return { error: "Not allowed." };
  if (!(await linkById(id))) return { error: "That link doesn't exist." };
  await updateLink(id, { revoked });
  revalidatePath("/studio"); revalidatePath(`/studio/links/${id}`);
  return {};
}

/** give a link more time: `days` from now, or no end at all (0) */
export async function extendLink(id: string, days: number): Promise<{ error?: string }> {
  if (!(await admin())) return { error: "Not allowed." };
  if (!(await linkById(id))) return { error: "That link doesn't exist." };
  const d = Math.max(0, Math.min(365, Math.round(days)));
  await updateLink(id, { expires_at: d ? new Date(Date.now() + d * 86_400_000).toISOString() : null, revoked: false });
  revalidatePath("/studio"); revalidatePath(`/studio/links/${id}`);
  return {};
}

/** change a link's prices (or the currency the client sees them in); the client sees the new prices next time they look */
export async function setLinkPricing(id: string, prices: Pricing): Promise<{ error?: string; pricing?: Pricing }> {
  if (!(await admin())) return { error: "Not allowed." };
  const link = await linkById(id);
  if (!link) return { error: "That link doesn't exist." };
  const pricing = cleanPricing(normalizePricing(prices), await designsByIds(link.design_ids), normalizeAllow(link.allow));
  await updateLink(id, { pricing });
  revalidatePath(`/studio/links/${id}`);
  return { pricing };
}
