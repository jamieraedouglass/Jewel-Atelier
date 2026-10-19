"use client";

export async function compressImage(file: Blob, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't process image"))), "image/jpeg", 0.88));
}

export async function videoFrames(file: File, count = 4, maxSide = 1400): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error("This browser can't read that video. Try a photo or an .mp4."));
    });
    const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext("2d")!;
    const out: Blob[] = [];
    for (let i = 0; i < count; i++) {
      v.currentTime = (dur * (i + 0.5)) / count;
      await new Promise<void>((res) => (v.onseeked = () => res()));
      ctx.drawImage(v, 0, 0, c.width, c.height);
      out.push(await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Frame capture failed"))), "image/jpeg", 0.88)));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const dataUrl = (b: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
