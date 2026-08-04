/* eslint-disable @next/next/no-img-element -- a runtime canvas data: URL, not a static asset */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ViewGallery from "./ViewGallery";
import {
  RING_VIEWS,
  type Category,
  type RingShots,
  type RingView,
} from "@/lib/designer/types";

const VIEW_LABELS: Record<RingView, string> = {
  front: "Front",
  side: "Side",
  top: "Top",
  bottom: "Bottom",
};

type Props = {
  open: boolean;
  categories: Category[];
  shots: RingShots | null;
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
  shots,
  onClose,
  onShare,
  shareLabel = "Copy design link",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const [galleryView, setGalleryView] = useState<RingView | null>(null);

  // This component stays mounted while closed, so gallery state would survive a close and
  // reopen — landing the user straight back in the gallery. Every close path goes through
  // here so that cannot happen.
  const close = useCallback(() => {
    setGalleryView(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      // The gallery sits above this dialog and owns the keyboard while it is open, so Escape
      // closes the gallery first instead of dismissing both at once.
      if (galleryView) return;
      if (e.key === "Escape") {
        close();
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
  }, [open, close, galleryView]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 md:grid md:place-items-center md:bg-ink-900/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review your ring"
        ref={panelRef}
        tabIndex={-1}
        className="flex h-full flex-col bg-sand-50 md:h-auto md:max-h-[92vh] md:w-[min(1040px,94vw)] md:rounded-lg md:shadow-sheet"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
      <div className="flex min-h-[52px] shrink-0 items-center justify-between border-b border-line/60 px-3">
        <h2 className="font-serif text-[17px] text-ink-900">Your ring</h2>
        <button
          type="button"
          onClick={close}
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
          Four orbit views in a grid. The boxes keep their size whether or not the captures
          have arrived: `openReview` batches the capture signal with opening the dialog, so the
          first committed render always has `shots` null and the images land a frame later.
          Rendering them conditionally without reserving space reflowed the whole summary
          downward every time the dialog opened.
        */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-4 sm:grid-cols-4">
          {RING_VIEWS.map((view) => (
            <figure key={view} className="m-0">
              {shots ? (
                <button
                  type="button"
                  onClick={() => setGalleryView(view)}
                  aria-label={`Open ${VIEW_LABELS[view]} view fullscreen`}
                  className="grid aspect-square w-full place-items-center overflow-hidden rounded-md border border-line/60 bg-sand-100 transition-colors hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
                >
                  {/* The button carries the label, so the image itself stays out of the
                      accessibility tree rather than announcing the same thing twice. */}
                  <img
                    src={shots[view]}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-contain"
                  />
                </button>
              ) : (
                <div className="grid aspect-square place-items-center overflow-hidden rounded-md border border-line/60 bg-sand-100">
                  <div
                    className="designer-spinner"
                    role="status"
                    aria-label="Rendering your ring"
                  />
                </div>
              )}
              <figcaption className="mt-1 text-center text-[13px] text-ink-600">
                {VIEW_LABELS[view]}
              </figcaption>
            </figure>
          ))}
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

      {galleryView && shots && (
        <ViewGallery
          shots={shots}
          view={galleryView}
          onView={setGalleryView}
          onClose={() => setGalleryView(null)}
        />
      )}
    </div>
  );
}
