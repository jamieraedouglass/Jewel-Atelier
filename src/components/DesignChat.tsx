"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadChat, noteAppliedSuggestion, noteDismissedSuggestion, saveChat } from "@/app/actions";
import { TYPE_LABEL, type Design, type DesignPatch } from "@/lib/design";
import { KEEP_MESSAGES, chatForApi, describePatch, type ChatMessage, type ChatProposal, plainReply } from "@/lib/chat";

type Props = { userId: string | null; designId: string | null; design: Design; onApply: (patch: DesignPatch) => void };

const STARTERS = [
  "Make this more maximalist",
  "What accents suit this main stone?",
  "Turn this into a bridal piece",
  "What should I tell the karigar about construction and weight?",
];

const MOODS = ["Whimsical", "Heirloom", "Romantic", "Serious", "Bold", "Quiet", "Regal", "Playful", "Modern", "Boho"];

export default function DesignChat({ userId, designId, design, onApply }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useStyle, setUseStyle] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const loadedFor = useRef<string | null>(null);
  const [ready, setReady] = useState(!designId);
  useEffect(() => {
    if (!userId || !designId || loadedFor.current === designId) return;
    const first = loadedFor.current === null;
    loadedFor.current = designId;
    if (!first || messages.length) { setReady(true); return; }
    loadChat(designId).then((m) => { setMessages((cur) => (cur.length ? cur : m)); setReady(true); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId, userId]);
  useEffect(() => {
    if (!userId || !designId || !ready) return;
    const t = setTimeout(() => { void saveChat(designId, messages.slice(-KEEP_MESSAGES)).catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [messages, designId, userId, ready]);

  if (!userId) return <p className="muted">Sign in to chat with the design consultant.</p>;

  const mark = (i: number, j: number, state: ChatProposal["state"]) =>
    setMessages((cur) => cur.map((m, k) => (k === i ? { ...m, proposals: m.proposals?.map((p, l) => (l === j ? { ...p, state } : p)) } : m)));

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const before = messages;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, useStyleProfile: useStyle, messages: chatForApi(next) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Chat failed.");
      setMessages([...next, { role: "assistant", content: json.reply || "…", proposals: json.proposals }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed.");
      setMessages(before);
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

      {ready && (
        <div style={{ display: "grid", gap: 6 }}>
          <span className="small muted">Change the feel{design.mood ? ` (now: ${design.mood})` : ""}</span>
          <div className="chips" role="group" aria-label="Change the feel">
            {MOODS.map((m) => <button key={m} type="button" className="chip" style={{ textTransform: "none" }} disabled={busy}
              onClick={() => send(`Make this feel more ${m.toLowerCase()}, in my own taste. Show me two or three different takes, from subtle to strong.`)}>{m}</button>)}
          </div>
        </div>
      )}

      {messages.length === 0 && ready && (
        <div className="chips">
          {STARTERS.map((s) => <button key={s} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} style={{ display: "grid", gap: 8 }}>
          <div className={`msg ${m.role}`}>{m.role === "assistant" ? plainReply(m.content) : m.content}</div>
          {m.proposals?.map((p, j) => (
            <div key={`${i}-${j}`} className="proposal" style={p.state === "dismissed" ? { opacity: 0.55 } : undefined}>
              <h4>{p.title}</h4>
              <p className="small" style={{ margin: 0 }}>{p.why}</p>
              <p className="small muted" style={{ margin: 0 }}>{describePatch(p.patch)}</p>
              {p.note && <p className="small" style={{ margin: 0, color: "var(--accent, #c9a96e)" }}>{p.note}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary" type="button" disabled={!!p.state}
                  onClick={() => { onApply(p.patch as DesignPatch); mark(i, j, "applied"); void noteAppliedSuggestion(p.title).catch(() => {}); }}>
                  {p.state === "applied" ? "Applied" : `Apply to ${TYPE_LABEL[design.type].toLowerCase()}`}
                </button>
                {!p.state && (
                  <button className="btn" type="button" title="The designer won't suggest this again"
                    onClick={() => { mark(i, j, "dismissed"); void noteDismissedSuggestion(p.title).catch(() => {}); }}>Not for me</button>
                )}
                {p.state === "dismissed" && <span className="small muted" style={{ alignSelf: "center" }}>Noted: won&apos;t suggest this again</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {busy && <div className="msg assistant muted">Thinking…</div>}
      {error && <p className="error">{error}</p>}
      <div ref={end} />

      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ display: "grid", gap: 8 }}>
        <textarea id="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about side stones, proportions, wearability… or a feeling: more whimsical, something that feels like an heirloom"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }} />
        <button className="btn primary" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </div>
  );
}
