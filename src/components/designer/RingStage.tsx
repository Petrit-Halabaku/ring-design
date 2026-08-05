"use client";

import { useEffect, useState } from "react";
import RingViewer from "@/components/three/RingViewer";
import type { SceneProps } from "@/components/three/RingScene";

const HINT_KEY = "designer-rotate-hint-seen";

/**
 * The canvas is transparent, so the studio sweep behind it shows through instead of a
 * colour being drawn in WebGL — the same arrangement the vendor's `.wrapper` rule uses.
 * That sweep is rendered full-bleed by DesignerShell rather than here, so it still fills the
 * viewport when the sheet collapses and the stage covers only part of it.
 *
 * Height comes from --layout-h minus --peek-h, both px written from JS. --layout-h ignores
 * the keyboard on purpose: sizing this from --app-h would shrink the stage every time the
 * engraving field is focused, and resizing a WebGL canvas drops frames. It is likewise
 * independent of the sheet's live drag position.
 */
export default function RingStage({
  describeRing,
  ...scene
}: SceneProps & { describeRing: string }) {
  // Read in an effect, not a lazy initialiser: sessionStorage is unavailable during SSR, so
  // initialising from it renders false on the server and true on the client's first pass —
  // a hydration mismatch.
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionStorage.getItem(HINT_KEY)) setShowHint(true);
  }, []);

  /*
   * How much of the canvas the top bar covers. The canvas is full-bleed and starts at y=0
   * with the translucent bar laid over it, so the scene has to be told to keep the ring out
   * of that strip — otherwise a correctly "fitted" ring still puts its stone behind the bar.
   * Measured rather than assumed: the bar is 52px plus env(safe-area-inset-top), which is
   * ~99px on a notched iPhone.
   */
  const [topInset, setTopInset] = useState(52);

  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".designer-root header");
    if (!bar) return;

    const measure = () => setTopInset(bar.getBoundingClientRect().height);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  function dismissHint() {
    if (!showHint) return;
    sessionStorage.setItem(HINT_KEY, "1");
    setShowHint(false);
  }

  return (
    <div
      className="relative shrink-0 h-[var(--stage-h)] md:h-full md:w-[calc(100%-var(--panel-w))]"
      style={{ "--stage-h": "calc(var(--layout-h) - var(--peek-h))" } as React.CSSProperties}
      onPointerDown={dismissHint}
    >
      {/* The studio sweep lives on the shell, full-bleed — see DesignerShell. */}

      {/*
        `describeRing` is destructured out above and never spread into RingViewer — it is
        not part of SceneProps, and forwarding it would be a type error.
      */}
      <div className="absolute inset-0" role="img" aria-label={`3D preview: ${describeRing}`}>
        <RingViewer {...scene} topInset={topInset} />
      </div>

      {showHint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[13px] text-ink-600 motion-safe:animate-pulse">
          Drag to rotate · pinch to zoom
        </p>
      )}
    </div>
  );
}
