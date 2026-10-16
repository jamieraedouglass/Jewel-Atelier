"use client";

import { useEffect, useRef, useState } from "react";
import { chatForApi, type ChatMessage } from "@/lib/chat";
import { describeChanges } from "@/lib/studio/links";
import type { Design } from "@/lib/design";
import type { ClientBackend } from "./backend";

const STARTERS = ["Would this suit everyday wear?", "What stone would make it feel more bridal?", "Is this size right for my hand?", "What would this cost?"];

/** The designer chat on a client link: suggestions arrive as finished pieces the client can apply in one tap. */
export default function ClientChat({ designId, base, design, history, backend, onApply, onHistory }: {
  designId: string; base: Design; design: Design; history: ChatMessage[]; backend: ClientBackend;
  onApply: (d: Design) => void; onHistory: (h: ChatMessage[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [history, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...history, { role: "user", content }];
    onHistory(next); setDraft(""); setBusy(true); setError(null);
    try {
      const r = await backend.chat(designId, design, chatForApi(next), next);
      onHistory([...next, { role: "assistant", content: r.reply || "…", proposals: r.proposals.map((p) => ({ title: p.title, why: p.why, patch: p.design as unknown as Record<string, unknown> })) }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The designer couldn't answer just now.");
      onHistory(history); setDraft(content);
    } finally { setBusy(false); }
  }
  const mark = (i: number, j: number, state: "applied" | "dismissed") =>
    onHistory(history.map((m, k) => (k === i ? { ...m, proposals: m.proposals?.map((p, l) => (l === j ? { ...p, state } : p)) } : m)));

  return (
    <div className="chat">
      <p className="small muted" style={{ margin: 0 }}>Ask about wear, sizing, which stone suits you, or how the piece is made. Suggestions stay within what the jeweller offers for this piece.</p>
      {!history.length && <div className="chips">{STARTERS.map((s) => <button key={s} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => send(s)}>{s}</button>)}</div>}
      {history.map((m, i) => (
        <div key={i} style={{ display: "grid", gap: 8 }}>
          <div className={`msg ${m.role}`}>{m.content}</div>
          {m.proposals?.map((p, j) => {
            // what trying it would change from the piece as it is now
            const changes = describeChanges(design, p.patch as unknown as Design);
            return (
              <div key={j} className="proposal" style={p.state === "dismissed" ? { opacity: 0.55 } : undefined}>
                <h4>{p.title}</h4>
                <p className="small" style={{ margin: 0 }}>{p.why}</p>
                {changes.length > 0 && <p className="small muted" style={{ margin: 0 }}>{changes.join(" · ")}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn primary" disabled={!!p.state} onClick={() => { onApply(p.patch as unknown as Design); mark(i, j, "applied"); }}>{p.state === "applied" ? "Applied" : "Try this"}</button>
                  {!p.state && <button type="button" className="btn" onClick={() => mark(i, j, "dismissed")}>No thanks</button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {busy && <div className="msg assistant muted">Thinking…</div>}
      {error && <p className="error">{error}</p>}
      <div ref={end} />
      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ display: "grid", gap: 8 }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask the designer…" aria-label="Your question"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }} />
        <button className="btn primary" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </div>
  );
}
