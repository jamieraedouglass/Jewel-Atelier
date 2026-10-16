"use client";

export default function PrintButton() {
  return <button type="button" className="btn primary no-print" onClick={() => window.print()}>Print for the workshop</button>;
}
