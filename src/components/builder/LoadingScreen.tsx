/* eslint-disable @next/next/no-img-element -- plain <img> matches the original markup that the copied CSS sizes directly */
"use client";

import { useEffect, useState } from "react";

type Props = {
  onDone: () => void;
};

/** "Building your dream ring..." interstitial shown between the walkthrough and the designer. */
export default function LoadingScreen({ onDone }: Props) {
  const [shown, setShown] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reveal = window.setTimeout(() => setShown(true), 50);
    const tick = window.setInterval(
      () => setProgress((p) => Math.min(100, p + 12)),
      180,
    );
    const done = window.setTimeout(onDone, 1900);
    return () => {
      window.clearTimeout(reveal);
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className={`jos-loading${shown ? " show-content" : ""}`}>
      <div className="jos-loading-container">
        <img id="jos-main-logo" src="/brand/casale-logo.webp" alt="Casale Jewelers" />
        <div className="jos-loading-spinner" />
        <div className="jos-loading-text">Building your dream ring...</div>
        <div className="jos-loading-progress">
          <div className="jos-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
