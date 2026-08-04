"use client";

import { useMemo, useRef, useState } from "react";
import { localModelUrl } from "@/lib/settings/models";
import { prongTipModel } from "@/lib/settings/prongs";
import { buildCategories } from "@/lib/designer/categories";
import { useRingConfig, type RingConfigInit } from "@/lib/designer/useRingConfig";
import { useVisualViewport } from "@/lib/designer/useVisualViewport";
import ControlGroup from "./controls/ControlGroup";
import CategoryRail from "./CategoryRail";
import RingStage from "./RingStage";
import TopBar from "./TopBar";

export default function DesignerShell({ shapeId, carat }: RingConfigInit) {
  const rootRef = useRef<HTMLDivElement>(null);
  useVisualViewport(rootRef);

  const cfg = useRingConfig({ shapeId, carat });
  const categories = useMemo(() => buildCategories(cfg), [cfg]);

  const [activeId, setActiveId] = useState(categories[0].id);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  const { stone, metal, prongMetal, value, angles, activeProngCount } = cfg;

  // Also reused by the live region in Task 9.
  const describeRing =
    `${metal.uiValue}, ${value.carat.toFixed(2)} carat ${stone.name}, ` +
    `${value.basketHalo} head, size ${value.ringSize.toFixed(2)}`;

  return (
    <div ref={rootRef} className="designer-root flex flex-col">
      <TopBar onRecenter={() => setRecenterSignal((n) => n + 1)} />

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
      />

      {/* Static placeholder for the sheet. Task 5 replaces this whole element. */}
      <div
        className="flex min-h-0 shrink-0 flex-col rounded-t-sheet bg-sand-50 shadow-sheet"
        style={{ height: "var(--peek-h)" }}
      >
        <CategoryRail
          categories={categories}
          activeId={activeId}
          onSelect={setActiveId}
        />

        <div
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="min-h-0 flex-1 divide-y divide-line/50 overflow-y-auto px-4 [overscroll-behavior:contain]"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {active.groups.map((g) => (
            <ControlGroup key={g.id} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
