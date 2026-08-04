"use client";

type Props = {
  onRecenter: () => void;
  onShare?: () => void;
  /** Transient confirmation ("Link copied"), or null when nothing to report. */
  shareStatus?: string | null;
};

/**
 * Stage controls: recentre, share.
 *
 * The bar spans only the stage, not the whole shell. At >=768px the options become a fixed
 * right-hand panel starting at y=0, so a full-width bar laid over the top of it and clipped
 * the category rail. `md:right-[var(--panel-w)]` stops the bar where the panel begins.
 */
export default function TopBar({ onRecenter, onShare, shareStatus }: Props) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-20 flex items-center justify-end gap-3 border-b border-line/40 bg-sand-200/70 px-3 backdrop-blur-md md:right-[var(--panel-w)]"
      style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "52px" }}
    >
      {/*
        Confirmation for the share control. It is an icon button with no room for a label, so
        a successful copy was previously indistinguishable from a dead button. role="status"
        announces it to screen readers as well, since the same press has no other outcome.
      */}
      {shareStatus && (
        <span
          role="status"
          className="rounded-full bg-ink-900 px-2.5 py-1 text-[13px] text-sand-50"
        >
          {shareStatus}
        </span>
      )}

      <div className="flex items-center">
        <button
          type="button"
          onClick={onRecenter}
          aria-label="Recentre the view"
          className="grid size-11 place-items-center rounded-md text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 4a8 8 0 1 1-8 8" />
            <path d="M4 4v5h5" />
          </svg>
        </button>

        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share this design"
            className="grid size-11 place-items-center rounded-md text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15V3m0 0L8 7m4-4l4 4" />
              <path d="M4 14v5a2 2 0 002 2h12a2 2 0 002-2v-5" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
