"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localModelUrl } from "@/lib/settings/models";
import { prongTipModel } from "@/lib/settings/prongs";
import { buildCategories } from "@/lib/designer/categories";
import { useRingConfig, type RingConfigInit } from "@/lib/designer/useRingConfig";
import type { RingShots } from "@/lib/designer/types";
import { encodeConfig } from "@/lib/designer/shareCodec";
import { useVisualViewport } from "@/lib/designer/useVisualViewport";
import OptionSheet from "./OptionSheet";
import RingStage from "./RingStage";
import ReviewSheet from "./ReviewSheet";
import TopBar from "./TopBar";

export default function DesignerShell({ shapeId, carat }: RingConfigInit) {
  const rootRef = useRef<HTMLDivElement>(null);
  useVisualViewport(rootRef);

  const cfg = useRingConfig({ shapeId, carat });
  const categories = useMemo(() => buildCategories(cfg), [cfg]);

  const [activeId, setActiveId] = useState(categories[0].id);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [captureSignal, setCaptureSignal] = useState(0);
  const [shots, setShots] = useState<RingShots | null>(null);
  const [shareLabel, setShareLabel] = useState("Copy design link");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  const openReview = useCallback(() => {
    setShots(null);
    setCaptureSignal((n) => n + 1);
    setReviewOpen(true);
  }, []);

  const { stone, metal, prongMetal, value, angles, activeProngCount } = cfg;

  /**
   * Shows a transient confirmation. The top bar's share control is an icon with no room for a
   * label, so without this a successful copy looked identical to a dead button.
   */
  const flash = useCallback((message: string) => {
    setShareLabel(message);
    setShareStatus(message);
    // Cleared before re-arming, or a second press would inherit the first press's countdown
    // and snap the message away early.
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setShareLabel("Copy design link");
      setShareStatus(null);
    }, 2000);
  }, []);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const share = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}${encodeConfig(value)}`;

    // On a phone a share icon means the OS share sheet, which also provides its own
    // confirmation. Only fall through to the clipboard when there is no such sheet.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "My ring design", url });
        return;
      } catch (err) {
        // Dismissing the sheet is a deliberate cancel, not a failure to route around.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      // Clipboard is permission-gated and unavailable on insecure origins. Putting the
      // URL in the address bar still leaves the user something they can copy by hand.
      window.location.hash = encodeConfig(value).slice(1);
      flash("Link in address bar");
    }
  }, [value, flash]);

  // One description of the ring in words, used both as the canvas's accessible label and as
  // the text announced to screen readers when the configuration changes.
  const describeRing =
    `${metal.uiValue}, ${value.carat.toFixed(2)} carat ${stone.name}, ` +
    `${value.basketHalo} head, size ${value.ringSize.toFixed(2)}`;

  const [announcement, setAnnouncement] = useState("");

  // A configurator whose only feedback is a 3D render tells a screen-reader user nothing.
  // Debounced because dragging the carat slider fires on every step and would otherwise
  // flood the live region with dozens of partial announcements.
  useEffect(() => {
    const t = window.setTimeout(() => setAnnouncement(describeRing), 400);
    return () => window.clearTimeout(t);
  }, [describeRing]);

  return (
    <div ref={rootRef} className="designer-root relative flex flex-col md:flex-row">
      {/*
        The studio sweep is full-bleed behind everything, not scoped to the stage. At the
        sheet's `collapsed` state the stage is only ~62% of the viewport, so a stage-scoped
        backdrop would end in a hard horizontal line with a band of flat sand beneath it —
        which would make "collapse to see the whole ring" look broken. The canvas is
        transparent and keeps its own fixed height, so widening the backdrop cannot resize it.
      */}
      <div className="ring-stage-bg absolute inset-0" />

      <TopBar
        onRecenter={() => setRecenterSignal((n) => n + 1)}
        onShare={share}
        shareStatus={shareStatus}
      />

      <RingStage
        describeRing={describeRing}
        stone={stone}
        stoneModel={localModelUrl(stone.glbUrl)}
        carat={value.carat}
        metalColor={metal.material.color}
        ringSize={value.ringSize}
        bandWidthMm={value.bandWidth}
        prongAngles={angles}
        prongCountType={activeProngCount}
        prongTipModel={prongTipModel(value.prongTip)}
        prongTipId={value.prongTip}
        prongMetalColor={prongMetal.material.color}
        prongPave={value.prongPave}
        basketHalo={value.basketHalo}
        cathedral={value.cathedral}
        bandStyle={value.bandStyle}
        bandFit={value.bandFit}
        engravingText={value.engravingText}
        engravingFont={value.engravingFont}
        surpriseStones={value.surpriseStones}
        bandPave={value.bandPave}
        bandPaveLength={value.bandPaveLength}
        recenterSignal={recenterSignal}
        captureSignal={captureSignal}
        onCapture={setShots}
      />

      <OptionSheet
        categories={categories}
        activeId={activeId}
        onSelect={setActiveId}
        footer={
          <button
            type="button"
            onClick={openReview}
            className="min-h-12 w-full rounded-md bg-champagne-500 text-[15px] text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
          >
            Review your ring
          </button>
        }
      />

      <ReviewSheet
        open={reviewOpen}
        categories={categories}
        shots={shots}
        onClose={() => setReviewOpen(false)}
        onShare={share}
        shareLabel={shareLabel}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
