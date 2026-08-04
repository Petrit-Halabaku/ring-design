"use client";

type Props = {
  value: string;
  maxLength: number;
  onChange: (next: string) => void;
  label: string;
};

/**
 * 16px font is load-bearing, not taste: iOS Safari auto-zooms the whole page on focus for
 * any input below 16px, which the previous 12px engraving field did on every tap.
 */
export default function TextField({ value, maxLength, onChange, label }: Props) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        aria-label={label}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        enterKeyHint="done"
        className="min-h-11 flex-1 rounded-md border border-line bg-sand-50 px-3 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
      />
      <span className="shrink-0 font-serif text-[15px] tabular-nums text-ink-600">
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
