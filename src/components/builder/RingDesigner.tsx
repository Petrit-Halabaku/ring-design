"use client";

import { useMemo, useState } from "react";
import RingViewer from "@/components/three/RingViewer";
import { localModelUrl } from "@/lib/settings/models";
import {
  prongTipModel,
} from "@/lib/settings/prongs";
import { useRingConfig } from "@/lib/designer/useRingConfig";
import { buildCategories } from "@/lib/designer/categories";
import ControlGroup from "@/components/designer/controls/ControlGroup";

/**
 * The 3D Ring Designer.
 *
 * Options come from the configurator's own settings API (see lib/settings/client.ts) and
 * the ring is rendered from the vendor's GLB models.
 */

export type DesignerProps = {
  /** Wizard selections, if the walkthrough ran. */
  shapeId?: string;
  carat?: number;
};

export default function RingDesigner({ shapeId, carat: initialCarat }: DesignerProps) {
  const [open, setOpen] = useState<string | null>(null);
  const cfg = useRingConfig({ shapeId, carat: initialCarat });
  const { stone, value, metal, prongMetal, angles, activeProngCount } = cfg;

  const categories = useMemo(() => buildCategories(cfg), [cfg]);

  return (
    <div className="designer-root">
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        {/* Ring stage — real GLB models, same pipeline as the original */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {/*
            The vendor's studio sweep, applied exactly as their `.wrapper` rule does
            (bottom-anchored, cover). The canvas above it is transparent, so this shows
            through instead of a colour being drawn in WebGL.
          */}
          <div className="ring-stage-bg absolute inset-0" />

          <div className="absolute inset-0">
            <RingViewer
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
            />
          </div>

          {/* Option panels */}
          <div className="absolute inset-x-3 bottom-3 z-10 h-full space-y-2 overflow-y-auto md:inset-x-auto md:right-4 md:top-4 md:bottom-auto  md:w-[280px]">
            {categories.map((category) => {
              const isOpen = open === category.id;
              return (
                <div
                  key={category.id}
                  className="overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : category.id)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <div className="h-4 w-4 text-neutral-500">
                        {category.icon}
                      </div>
                      <span className="text-[15px] text-neutral-900">
                        {category.label}
                      </span>
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-neutral-100 px-4 py-3.5">
                      {category.groups.map((g) => (
                        <ControlGroup key={g.id} group={g} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
