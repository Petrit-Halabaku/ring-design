/* eslint-disable @next/next/no-img-element -- a runtime canvas data: URL, not a static asset */
"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/lib/designer/types";

type Props = {
  open: boolean;
  categories: Category[];
  imageUrl: string | null;
  onClose: () => void;
  onShare?: () => void;
  shareLabel?: string;
};

/** Renders a control's current selection as display text for the summary. */
function readValue(c: Category["groups"][number]["control"]): string {
  switch (c.kind) {
    case "swatch":
    case "shape":
    case "chip":
    case "segmented":
      return c.options.find((o) => o.id === c.value)?.label ?? "—";
    case "switch":
      return c.value ? "Yes" : "No";
    case "range":
      return c.format(c.value);
    case "text":
      return c.value.trim() || "None";
  }
}

export default function ReviewSheet({
  open,
  categories,
  imageUrl,
  onClose,
  onShare,
  shareLabel = "Copy design link",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap: a dialog the keyboard can escape into a hidden background is worse
      // than no dialog.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 md:grid md:place-items-center md:bg-ink-900/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review your ring"
        ref={panelRef}
        tabIndex={-1}
        className="flex flex-col bg-sand-50 md:h-auto md:max-h-[85vh] md:w-[640px] md:rounded-lg"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
      <div className="flex min-h-[52px] shrink-0 items-center justify-between border-b border-line/60 px-3">
        <h2 className="font-serif text-[17px] text-ink-900">Your ring</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close review"
          className="grid size-11 place-items-center rounded-md text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]">
        {/*
          The image box keeps its height whether or not the still has arrived. `openReview`
          batches the capture signal with opening the dialog, so the first committed render
          always has `imageUrl` null and the capture lands a frame later. Rendering the <img>
          conditionally without reserving its space reflowed the whole summary downward every
          time the dialog opened.
        */}
        <div className="grid h-[38vh] place-items-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Your ring as configured"
              className="max-h-[38vh] w-auto"
            />
          ) : (
            <div
              className="designer-spinner"
              role="status"
              aria-label="Rendering your ring"
            />
          )}
        </div>

        <dl className="px-4 pb-4">
          {categories.map((c) => (
            <div key={c.id} className="border-t border-line/50 py-3 first:border-t-0">
              <h3 className="font-serif text-[15px] text-ink-900">{c.label}</h3>
              {c.groups.map((g) => (
                <div key={g.id} className="mt-2 flex items-baseline justify-between gap-4">
                  <dt className="text-[13px] text-ink-600">{g.label}</dt>
                  <dd className="font-serif text-[15px] text-ink-900">
                    {readValue(g.control)}
                  </dd>
                </div>
              ))}
            </div>
          ))}
        </dl>
      </div>

      <div
        className="shrink-0 space-y-2 border-t border-line/60 px-4 pt-3"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          className="min-h-12 w-full rounded-md bg-champagne-500 text-[15px] text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          Contact a jeweler
        </button>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="min-h-12 w-full rounded-md border border-line text-[15px] text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
          >
            {shareLabel}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
