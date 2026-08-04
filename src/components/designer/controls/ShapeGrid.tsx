/* eslint-disable @next/next/no-img-element -- inline SVGs from /public/shapes, sized by CSS */
"use client";

import type { IconOption } from "@/lib/designer/types";

type Props = {
  options: IconOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

export default function ShapeGrid({ options, value, onChange, label }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-md border px-1 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
              active
                ? "border-ink-900 bg-sand-100"
                : "border-line bg-transparent hover:border-ink-400"
            }`}
          >
            <img src={o.svg} alt="" aria-hidden className="size-10" />
            <span className="text-[13px] leading-tight text-ink-900">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
