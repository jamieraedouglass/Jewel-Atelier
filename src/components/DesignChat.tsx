"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Design, DesignPatch } from "@/lib/design";

type Proposal = { title: string; why: string; patch: DesignPatch };
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };
type Props = { userId: string | null; design: Design; onApply: (patch: DesignPatch) => void };

const STARTERS = [
  "Make this more maximalist",
  "What accents suit this main stone?",
  "Turn this into a bridal piece",
  "What should I tell the karigar about construction and weight?",
];

function describePatch(p: DesignPatch): string {
  const parts: string[] = [];
  const walk = (o: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(o)) {
      if (k === "motif" && v && typeof v === "object") { parts.push(`motif: ${(v as { name?: string }).name ?? "custom"}`); continue; }
      if (v && typeof v === "object") walk(v as Record<string, unknown>, `${prefix}${k} `);
      else parts.push(`${prefix}${k}: ${typeof v === "number" ? Math.round(v * 100) / 100 : String(v)}`);
    }
  };
  walk(p as Record<string, unknown>);
  return parts.join(" · ");
}

export default function DesignChat({ userId, design, onApply }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useStyle, setUseStyle] = useState(true);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  if (!userId) return <p className="muted">Sign in to chat with the design consultant.</p>;

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design,
          useStyleProfile: useStyle,
          // proposals are folded into the text so the model remembers what it suggested
          messages: next.map((m) => ({
            role: m.role,
            content: m.proposals?.length ? `${m.content}\n${m.proposals.map((p) => `[Suggested: ${p.title} — ${describePatch(p.patch)}]`).join("\n")}` : m.content,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Chat failed.");
      setMessages([...next, { role: "assistant", content: json.reply || "…", proposals: json.proposals }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed.");
      setMessages(messages);
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input id="use-style" type="checkbox" checked={useStyle} onChange={(e) => setUseStyle(e.target.checked)} />
        Use my <Link href="/style">style profile</Link>
      </label>

      {messages.length === 0 && (
        <div className="chips">
          {STARTERS.map((s) => <button key={s} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} style={{ display: "grid", gap: 8 }}>
          <div className={`msg ${m.role}`}>{m.content}</div>
          {m.proposals?.map((p, j) => {
            const key = `${i}-${j}`;
            return (
              <div key={key} className="proposal">
                <h4>{p.title}</h4>
                <p className="small" style={{ margin: 0 }}>{p.why}</p>
                <p className="small muted" style={{ margin: 0 }}>{describePatch(p.patch)}</p>
                <button className="btn primary" type="button" disabled={applied.has(key)}
                  onClick={() => { onApply(p.patch); setApplied(new Set(applied).add(key)); }}>
                  {applied.has(key) ? "Applied" : "Apply to ring"}
                </button>
              </div>
            );
          })}
        </div>
      ))}
      {busy && <div className="msg assistant muted">Thinking…</div>}
      {error && <p className="error">{error}</p>}
      <div ref={end} />

      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ display: "grid", gap: 8 }}>
        <textarea id="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about side stones, proportions, wearability…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }} />
        <button className="btn primary" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </div>
  );
}
