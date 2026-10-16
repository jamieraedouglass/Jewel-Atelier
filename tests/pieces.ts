import { DROP_PRESETS, FRAME_PRESETS, SHOWCASE, STYLES, TYPES, applyPatch, chooseStyle, defaultDesign, type Design, type DesignPatch } from "@/lib/design";

/** every design worth building in a test: each style's defaults, each showcase piece, each drop and frame preset */
export function allDesigns(): { name: string; design: Design }[] {
  const out: { name: string; design: Design }[] = [];
  for (const t of TYPES) for (const s of Object.keys(STYLES[t])) out.push({ name: `style ${t}/${s}`, design: chooseStyle(defaultDesign(), t, s) });
  for (const s of SHOWCASE) {
    const fresh = defaultDesign();
    out.push({ name: `showcase ${s.name}`, design: applyPatch(chooseStyle(fresh, s.type, s.style), s.patch) });
  }
  for (const p of DROP_PRESETS)
    out.push({ name: `drop ${p.name}`, design: applyPatch(chooseStyle(defaultDesign(), "earrings", "pendant"), { drop: { parts: p.parts } } as DesignPatch) });
  for (const p of FRAME_PRESETS)
    out.push({ name: `frames ${p.name}`, design: applyPatch(chooseStyle(defaultDesign(), "ring", "deco"), { frames: p.frames, ...(p.center ? { center: p.center } : {}) } as DesignPatch) });
  // options that change how a style is built
  for (const hang of ["in-chain", "below", "drop"] as const)
    out.push({ name: `option three-stone pendant hangs ${hang}`, design: applyPatch(chooseStyle(defaultDesign(), "necklace", "three-stone-pendant"), { options: { hang } }) });
  out.push({ name: "option pendant set into the chain", design: applyPatch(chooseStyle(defaultDesign(), "necklace", "pendant"), { options: { hang: "in-chain" } }) });
  for (const [t, st] of [["ring", "halo"], ["ring", "cluster"], ["earrings", "stud"], ["necklace", "pendant"]] as const)
    out.push({ name: `option ${t}/${st} accents off`, design: applyPatch(chooseStyle(defaultDesign(), t, st), { options: { halo: true }, accents: { enabled: false } }) });
  return out;
}
