"use client";

import { useEffect, useRef, useState } from "react";
import type { Design } from "@/lib/design";

const TYPED_INPUTS = new Set(["text", "number", "search", "email", "url", "tel", "password"]);
const ownsUndo = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
  return el.tagName === "INPUT" && TYPED_INPUTS.has((el as HTMLInputElement).type);
};

export function useHistory(initial: Design, onChanged: () => void) {
  const [design, setDesign] = useState(initial);
  const designRef = useRef(design);
  designRef.current = design;
  const hist = useRef<{ past: Design[]; future: Design[]; last: number }>({ past: [], future: [], last: 0 });
  const [, bump] = useState(0);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  const show = (d: Design) => { designRef.current = d; setDesign(d); bump((n) => n + 1); changed.current(); };

  function record(next: Design, group: boolean) {
    const h = hist.current, now = Date.now();
    if (next === designRef.current) return;
    if (!group || now - h.last > 800) { h.past.push(designRef.current); if (h.past.length > 150) h.past.shift(); }
    h.last = group ? now : 0;
    h.future = [];
    show(next);
  }
  function undo() {
    const h = hist.current, prev = h.past.pop();
    if (!prev) return false;
    h.future.push(designRef.current); h.last = 0;
    show(prev);
    return true;
  }
  function redo() {
    const h = hist.current, nxt = h.future.pop();
    if (!nxt) return false;
    h.past.push(designRef.current); h.last = 0;
    show(nxt);
    return true;
  }

  const actions = useRef({ undo, redo });
  actions.current = { undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ownsUndo(e.target) || !(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); actions.current.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); actions.current.redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { design, designRef, record, undo, redo, canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0 };
}
