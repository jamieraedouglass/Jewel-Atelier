/**
 * How a client link looks when it's shared (WhatsApp, iMessage, email): the first piece's picture, its name and who it
 * was designed for. The apps that build these previews open the link themselves, which must not count as the client
 * opening it.
 */

const PREVIEW_BOTS = /bot\b|crawler|spider|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skypeuripreview|embedly|linkedin|pinterest|google-?inspectiontool|bingpreview|iframely|vkshare|redditbot|applebot|headless/i;

/** a link-preview robot rather than a person (no user agent at all counts as a robot too) */
export const isPreviewBot = (userAgent: string | null | undefined) => !userAgent || PREVIEW_BOTS.test(userAgent);

export function linkPreviewText(studio: string, clientName: string, pieceNames: string[]) {
  const first = pieceNames[0] ?? "Your piece";
  const more = pieceNames.length > 1 ? ` and ${pieceNames.length - 1} more` : "";
  return {
    title: `${first}${more}${clientName ? ` · for ${clientName}` : ""}`,
    description: `Designed for you by ${studio}. See it in 3D, try it on, and adjust it with us.`,
  };
}

/** the public address of a saved thumbnail (the thumbnails bucket is public) */
export const thumbnailUrl = (supabaseUrl: string | undefined, path: string | null | undefined) =>
  supabaseUrl && path ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/thumbnails/${path.split("/").map(encodeURIComponent).join("/")}` : null;
