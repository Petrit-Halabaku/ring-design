"use client";

import type { TextOption } from "@/lib/designer/types";

type Props = {
  options: TextOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

export default function ChipRow({ options, value, onChange, label }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`inline-flex min-h-11 items-center rounded-md border px-3.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
              active
                ? "border-ink-900 bg-ink-900 text-sand-50"
                : "border-line text-ink-900 hover:border-ink-400"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
