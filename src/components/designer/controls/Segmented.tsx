"use client";

import type { TextOption } from "@/lib/designer/types";

type Props = {
  options: TextOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

/** Two or three mutually exclusive options. Four or more should use ChipRow. */
export default function Segmented({ options, value, onChange, label }: Props) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative flex min-h-11 rounded-md bg-sand-100 p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-sm bg-ink-900 transition-[left] duration-200 ease-sheet motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          left: `calc(0.25rem + (100% - 0.5rem) / ${options.length} * ${index})`,
        }}
      />
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`relative z-10 flex-1 rounded-sm px-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
              active ? "text-sand-50" : "text-ink-600"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
