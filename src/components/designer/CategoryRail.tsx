"use client";

import type { RefObject } from "react";
import type { Category } from "@/lib/designer/types";

type Props = {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  railRef?: RefObject<HTMLDivElement | null>;
};

/**
 * A real tablist: arrow keys move between categories, and the active tab is the only
 * place champagne appears besides the primary CTA.
 */
export default function CategoryRail({ categories, activeId, onSelect, railRef }: Props) {
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
      <div
        role="tablist"
        aria-label="Ring options"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto px-2 [scroll-padding-inline:0.5rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              role="tab"
              id={`tab-${c.id}`}
              aria-selected={active}
              aria-controls={`panel-${c.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(c.id)}
              className={`relative flex min-h-[52px] shrink-0 items-center gap-1.5 px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
                active ? "text-ink-900" : "text-ink-600"
              }`}
            >
              <span aria-hidden className={active ? "text-champagne-500" : "text-ink-400"}>
                {c.icon}
              </span>
              {c.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-champagne-500"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
