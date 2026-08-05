"use client";

import type { RefObject } from "react";
import type { Category } from "@/lib/designer/types";

type Props = {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Whether the options body is showing. The active tab doubles as its disclosure. */
  expanded?: boolean;
  railRef?: RefObject<HTMLDivElement | null>;
};

/**
 * A real tablist: arrow keys move between categories, and the active tab is the only
 * place champagne appears besides the primary CTA.
 *
 * On a phone the active tab is also the disclosure for the options body — tapping it again
 * collapses the sheet — so it carries `aria-expanded`. The parent owns that behaviour; this
 * component only reports the state.
 */
export default function CategoryRail({
  categories,
  activeId,
  onSelect,
  expanded,
  railRef,
}: Props) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = categories.findIndex((c) => c.id === activeId);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(categories[(i + 1) % categories.length].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(categories[(i - 1 + categories.length) % categories.length].id);
    }
  }

  return (
    <div ref={railRef} className="border-b border-line/60">
      {/*
        An equal-width grid, not a horizontally scrolling flex row.
        Laid out side by side with icons, the five tabs measure ~465px — wider than every
        target viewport (320/360/390px phones and the 360px desktop panel). Since the rail
        also hid its scrollbar, four categories were simply unreachable with no affordance
        that they existed. A 5-column grid always fits; the icon moves above the label to buy
        the horizontal room.
      */}
      <div
        role="tablist"
        aria-label="Ring options"
        onKeyDown={onKeyDown}
        className="grid grid-cols-5"
      >
        {categories.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              role="tab"
              id={`tab-${c.id}`}
              aria-selected={active}
              aria-expanded={active ? expanded : undefined}
              aria-controls={`panel-${c.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(c.id)}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-center text-[13px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
                active ? "text-ink-900" : "text-ink-600"
              }`}
            >
              <span aria-hidden className={active ? "text-ink-900" : "text-ink-400"}>
                {c.icon}
              </span>
              {c.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-champagne-500"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
