/* eslint-disable @next/next/no-img-element -- runtime canvas data: URLs, not static assets */
"use client";

import { useEffect, useRef } from "react";
import { RING_VIEWS, type RingShots, type RingView } from "@/lib/designer/types";

const VIEW_LABELS: Record<RingView, string> = {
  front: "Front",
  side: "Side",
  top: "Top",
  bottom: "Bottom",
};

type Props = {
  shots: RingShots;
  view: RingView;
  onView: (view: RingView) => void;
  onClose: () => void;
};

/**
 * Fullscreen viewer for the four captured views.
 *
 * Rendered above the review dialog, which has its own Escape handler — the review sheet skips
 * its key handling while this is open, so Escape closes the gallery first rather than dumping
 * the user out of both at once.
 */
export default function ViewGallery({ shots, view, onView, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function step(delta: number) {
      const i = RING_VIEWS.indexOf(view);
      const next = (i + delta + RING_VIEWS.length) % RING_VIEWS.length;
      onView(RING_VIEWS[next]);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    // Capture phase so this runs before the review dialog's own document-level handler.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreTo.current?.focus();
    };
  }, [view, onView, onClose]);

  const index = RING_VIEWS.indexOf(view);
  const prev = RING_VIEWS[(index - 1 + RING_VIEWS.length) % RING_VIEWS.length];
  const next = RING_VIEWS[(index + 1) % RING_VIEWS.length];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${VIEW_LABELS[view]} view, ${index + 1} of ${RING_VIEWS.length}`}
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-0 z-40 flex flex-col bg-ink-900/95 backdrop-blur-sm"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex min-h-[52px] shrink-0 items-center justify-between px-3">
        <p className="font-serif text-[17px] text-sand-50">
          {VIEW_LABELS[view]}
          <span className="ml-2 text-[13px] text-sand-300">
            {index + 1} / {RING_VIEWS.length}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="grid size-11 place-items-center rounded-md text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/*
        Clicking the empty area closes, which is what people expect of a lightbox. The image
        and the arrows stop propagation so a mis-tap near them does not dismiss the gallery.
      */}
      <div
        className="flex min-h-0 flex-1 items-center justify-between gap-2 px-2"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView(prev);
          }}
          aria-label={`Previous view: ${VIEW_LABELS[prev]}`}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-sand-50/10 text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <img
          src={shots[view]}
          alt={`${VIEW_LABELS[view]} view of your ring`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full min-h-0 w-auto max-w-full object-contain"
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView(next);
          }}
          aria-label={`Next view: ${VIEW_LABELS[next]}`}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-sand-50/10 text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex shrink-0 justify-center gap-2 px-3">
        {RING_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            aria-label={`Show ${VIEW_LABELS[v]} view`}
            aria-current={v === view}
            className={`h-14 w-14 overflow-hidden rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
              v === view ? "border-champagne-500" : "border-sand-50/25"
            }`}
          >
            <img
              src={shots[v]}
              alt=""
              aria-hidden
              className="h-full w-full object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
