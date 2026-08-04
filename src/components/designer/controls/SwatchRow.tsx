"use client";

import type { SwatchOption } from "@/lib/designer/types";

type Props = {
  options: SwatchOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

/**
 * Metal colours, filled with the hex the settings API reports.
 *
 * Four or fewer options fit the panel as an equal row (colour families). Longer lists
 * (e.g. Prong Metal) keep a horizontal scroll; the selected name prints below those.
 */
export default function SwatchRow({ options, value, onChange, label }: Props) {
  const selected = options.find((o) => o.id === value);
  const compact = options.length <= 4;

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        className={
          compact
            ? "flex gap-2 py-1"
            : "-mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              onClick={() => onChange(o.id)}
              className={`grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
                compact ? "flex-1" : "shrink-0 snap-start"
              }`}
            >
              <span
                className={`block size-9 rounded-full border border-line ${
                  active ? "ring-2 ring-ink-900 ring-offset-[3px] ring-offset-sand-50" : ""
                }`}
                style={{ background: o.hex }}
              />
            </button>
          );
        })}
      </div>
      {!compact && selected && (
        <p className="mt-2 font-serif text-[15px] text-ink-900">{selected.label}</p>
      )}
    </div>
  );
}
