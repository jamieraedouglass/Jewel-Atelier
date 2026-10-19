// When something happened, for the studio's lists: "19 Oct, 9:13 am", or the fallback if it hasn't yet.
export const when = (iso: string | null, fallback = "never") =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : fallback;
