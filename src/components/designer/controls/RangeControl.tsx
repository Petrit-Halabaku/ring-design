"use client";

import type { CSSProperties } from "react";

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  presets?: number[];
  format: (n: number) => string;
  onChange: (next: number) => void;
  label: string;
};

/**
 * Preset ticks are the point of this control: dragging a native range to exactly 1.00ct
 * on a phone is miserable, so the common values are one tap. Presets are spaced evenly
 * for easy tapping; the track fill still follows the current value.
 */
export default function RangeControl({
  min,
  max,
  step,
  value,
  presets,
  format,
  onChange,
  label,
}: Props) {
  const span = max - min || 1;
  const pct = Math.min(100, Math.max(0, ((value - min) / span) * 100));
  const activePreset = (p: number) => Math.abs(p - value) < step / 2;

  return (
    <div style={{ "--range-pct": `${pct}%` } as CSSProperties}>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="designer-range w-full"
      />
      {presets && presets.length > 0 && (
        <div className="relative mt-1 flex h-11 w-full justify-between">
          {presets.map((p) => {
            const active = activePreset(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-label={format(p)}
                aria-pressed={active}
                className={`min-h-11 min-w-11 text-[12px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
                  active ? "font-medium text-ink-900" : "text-ink-600"
                }`}
              >
                {format(p)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
