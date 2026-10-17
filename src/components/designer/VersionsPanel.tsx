"use client";

import { describeDesign, normalizeDesign, type Design } from "@/lib/design";

export type Version = { id: string; name: string; created_at: string; data: unknown };

export default function VersionsPanel({ versions, onRestore, onClose }: { versions: Version[]; onRestore: (d: Design) => void; onClose: () => void }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Saved versions</h3>
        <button type="button" className="chip" onClick={onClose} aria-label="Close versions">×</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Every save keeps a version (the last 40). Bringing one back puts it on screen; press Save to keep it, or Undo to go back.</p>
      {!versions.length && <p className="small muted">No versions yet. They start with the next save.</p>}
      {versions.map((v, i) => (
        <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          <span className="small">
            {new Date(v.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            {i === 0 && <span className="muted"> · latest save</span>}
            <br /><span className="muted">{describeDesign(normalizeDesign(v.data)).slice(0, 90)}</span>
          </span>
          <button type="button" className="btn" onClick={() => onRestore(normalizeDesign(v.data))}>Bring back</button>
        </div>
      ))}
    </section>
  );
}
