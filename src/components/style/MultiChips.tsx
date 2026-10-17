"use client";

export default function MultiChips<T extends string>({ name, options, value, onChange, fmt, max = 99, swatch }: {
  name: string; options: readonly T[]; value: readonly T[]; onChange: (v: T[]) => void; fmt: (v: T) => string; max?: number; swatch?: (v: T) => string | undefined;
}) {
  const toggle = (o: T) => onChange(value.includes(o) ? value.filter((x) => x !== o) : value.length < max ? [...value, o] : [...value]);
  return (
    <div className="chips" role="group" aria-label={name}>
      {options.map((o) => (
        <button key={o} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={value.includes(o)} onClick={() => toggle(o)}>
          {swatch?.(o) && <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: swatch(o), marginRight: 6 }} />}
          {fmt(o)}
        </button>
      ))}
    </div>
  );
}
