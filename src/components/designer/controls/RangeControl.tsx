"use client";

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
 * on a phone is miserable, so the common values are one tap.
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
  return (
    <div>
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
        <div className="mt-1 flex justify-between">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`min-h-11 min-w-11 text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
                Math.abs(p - value) < step / 2 ? "text-ink-900" : "text-ink-600"
              }`}
            >
              {format(p)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
