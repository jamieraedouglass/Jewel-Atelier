const PREVIEW_BOTS = /bot\b|crawler|spider|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skypeuripreview|embedly|linkedin|pinterest|google-?inspectiontool|bingpreview|iframely|vkshare|redditbot|applebot|headless/i;

export const isPreviewBot = (userAgent: string | null | undefined) => !userAgent || PREVIEW_BOTS.test(userAgent);

export function linkPreviewText(studio: string, clientName: string, pieceNames: string[]) {
  const first = pieceNames[0] ?? "Your piece";
  const more = pieceNames.length > 1 ? ` and ${pieceNames.length - 1} more` : "";
  return {
    title: `${first}${more}${clientName ? ` · for ${clientName}` : ""}`,
    description: `Designed for you by ${studio}. See it in 3D, try it on, and adjust it with us.`,
  };
}

export const thumbnailUrl = (supabaseUrl: string | undefined, path: string | null | undefined) =>
  supabaseUrl && path ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/thumbnails/${path.split("/").map(encodeURIComponent).join("/")}` : null;
