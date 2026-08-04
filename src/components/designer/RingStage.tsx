"use client";

import { useState } from "react";
import RingViewer from "@/components/three/RingViewer";
import type { SceneProps } from "@/components/three/RingScene";

const HINT_KEY = "designer-rotate-hint-seen";

/**
 * The canvas is transparent, so the studio sweep behind it shows through instead of a
 * colour being drawn in WebGL — the same arrangement the vendor's `.wrapper` rule uses.
 *
 * Height comes from --app-h minus --peek-h, both px values written from JS. It is
 * deliberately independent of the sheet's live drag position: resizing a WebGL canvas
 * mid-gesture drops frames.
 */
export default function RingStage({
  describeRing,
  ...scene
}: SceneProps & { describeRing: string }) {
  const [showHint, setShowHint] = useState(() =>
    typeof sessionStorage !== "undefined" ? !sessionStorage.getItem(HINT_KEY) : false,
  );

  function dismissHint() {
    if (!showHint) return;
    sessionStorage.setItem(HINT_KEY, "1");
    setShowHint(false);
  }

  return (
    <div
      className="relative shrink-0"
      style={{ height: "calc(var(--app-h) - var(--peek-h))" }}
      onPointerDown={dismissHint}
    >
      <div className="ring-stage-bg absolute inset-0" />

      {/*
        `describeRing` is destructured out above and never spread into RingViewer — it is
        not part of SceneProps, and forwarding it would be a type error.
      */}
      <div className="absolute inset-0" role="img" aria-label={`3D preview: ${describeRing}`}>
        <RingViewer {...scene} />
      </div>

      {showHint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[13px] text-ink-600 motion-safe:animate-pulse">
          Drag to rotate · pinch to zoom
        </p>
      )}
    </div>
  );
}
