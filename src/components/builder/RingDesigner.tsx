"use client";

import { useMemo, useState } from "react";
import RingViewer from "@/components/three/RingViewer";
import { localModelUrl } from "@/lib/settings/models";
import {
  PRONG_TIPS,
  prongTipModel,
} from "@/lib/settings/prongs";
import { BASKET_HALOS } from "@/lib/settings/basketHalo";
import { BAND_FITS, BAND_STYLES } from "@/lib/settings/bandGeometry";
import { BAND_PAVE_LENGTHS } from "@/lib/settings/bandPave";
import { useRingConfig } from "@/lib/designer/useRingConfig";

/**
 * The 3D Ring Designer.
 *
 * Options come from the configurator's own settings API (see lib/settings/client.ts) and
 * the ring is rendered from the vendor's GLB models. The static groups below (head, band,
 * engraving) mirror the live UI; the original serves them from the same backend behind
 * endpoints that need a jeweler key.
 */

type Choice = { label: string };
type Group = { label: string; hint?: string; choices: Choice[]; selected: number };
type Panel = { id: string; label: string; icon: string; groups: Group[] };

const STATIC_PANELS: Panel[] = [
  {
    id: "band",
    label: "Band",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 110 10 5 5 0 010-10z",
    groups: [
      {
        label: "Style",
        hint: "Round",
        selected: 0,
        choices: [{ label: "Round" }, { label: "Square" }],
      },
      {
        label: "Cathedral",
        hint: "No Cathedral",
        selected: 0,
        choices: [{ label: "None" }, { label: "Cathedral" }],
      },
      {
        label: "Pave Style",
        hint: "None",
        selected: 0,
        choices: [{ label: "None" }, { label: "Petite French" }],
      },
      {
        label: "Fit",
        hint: "Comfort Fit",
        selected: 0,
        choices: [{ label: "Comfort Fit" }, { label: "Standard Fit" }],
      },
      {
        label: "Pave Length",
        hint: "Half",
        selected: 1,
        choices: [
          { label: "One Third" },
          { label: "Half" },
          { label: "Two Thirds" },
          { label: "Three Quarters" },
          { label: "Eternity" },
        ],
      },
    ],
  },
  {
    id: "more",
    label: "More",
    icon: "M4 7h16M4 12h16M4 17h10",
    groups: [
      {
        label: "Engraving Style",
        hint: "Choose your font-style",
        selected: 0,
        choices: [{ label: "Block" }, { label: "Cursive" }],
      },
      {
        label: "Surprise Stones",
        hint: "No Surprise Stones",
        selected: 0,
        choices: [{ label: "None" }, { label: "Add Stones" }],
      },
    ],
  },
];

const HEAD_ICON = "M12 3l3 5H9zM5 10h14l-7 11z";
const METAL_ICON = "M12 2l4 6-4 14L8 8z";
const DIAMOND_ICON = "M6 3h12l4 6-10 12L2 9z";

export type DesignerProps = {
  /** Wizard selections, if the walkthrough ran. */
  shapeId?: string;
  carat?: number;
};

export default function RingDesigner({ shapeId, carat: initialCarat }: DesignerProps) {
  const [open, setOpen] = useState<string | null>(null);
  const cfg = useRingConfig({ shapeId, carat: initialCarat });
  const { settings, stones, stone, metal, prongMetal, caratRange,
          prongCountOptions, activeProngCount, angles, value, set } = cfg;

  const panels: Panel[] = useMemo(
    () => [
      {
        id: "metal",
        label: "Metal",
        icon: METAL_ICON,
        groups: [
          {
            label: "Head & Band Color",
            hint: metal.description,
            selected: value.metalIdx,
            choices: settings.metals.map((m) => ({ label: m.uiValue })),
          },
        ],
      },
      {
        id: "diamonds",
        label: "Diamonds",
        icon: DIAMOND_ICON,
        groups: [
          {
            label: "Select Your Stones",
            hint: `Center: ${value.carat} carat ${stone.name}`,
            selected: value.stoneIdx,
            choices: stones.map((s) => ({ label: s.name })),
          },
          {
            label: "Diamond Type",
            hint: "Natural diamond center stones & pave (if applicable)",
            selected: value.diamondType === "Lab Grown" ? 1 : 0,
            choices: [{ label: "Natural" }, { label: "Lab Grown" }],
          },
        ],
      },
      {
        id: "head",
        label: "Head",
        icon: HEAD_ICON,
        groups: [
          {
            label: "Basket & Halo",
            hint:
              BASKET_HALOS.find((b) => b.id === value.basketHalo)?.hint ??
              "No basket/halo",
            selected: Math.max(
              0,
              BASKET_HALOS.findIndex((b) => b.id === value.basketHalo),
            ),
            choices: BASKET_HALOS.map((b) => ({ label: b.label })),
          },
          {
            label: "Prong Count",
            hint: `${angles.length} prong ${activeProngCount} setting`,
            selected: Math.max(0, prongCountOptions.indexOf(activeProngCount)),
            choices: prongCountOptions.map((c) => ({ label: c })),
          },
          {
            label: "Prong Tips",
            hint: `${value.prongTip} Prong Tips`,
            selected: Math.max(
              0,
              PRONG_TIPS.findIndex((t) => t.id === value.prongTip),
            ),
            choices: PRONG_TIPS.map((t) => ({ label: t.label })),
          },
          {
            label: "Prong Pave",
            hint: value.prongPave ? "Pave prong arms" : "Plain prong arms",
            selected: value.prongPave ? 1 : 0,
            choices: [{ label: "None" }, { label: "Pave" }],
          },
          {
            label: "Prong Metal",
            hint:
              value.prongMetalIdx === null
                ? "Matches the band"
                : prongMetal.description,
            selected: value.prongMetalIdx === null ? 0 : value.prongMetalIdx + 1,
            choices: [
              { label: "Match Band" },
              ...settings.metals.map((m) => ({ label: m.uiValue })),
            ],
          },
        ],
      },
      ...STATIC_PANELS,
    ],
    [
      settings.metals,
      stones,
      metal,
      value.metalIdx,
      stone,
      value.stoneIdx,
      value.carat,
      value.diamondType,
      angles.length,
      activeProngCount,
      prongCountOptions,
      value.prongTip,
      value.prongPave,
      value.prongMetalIdx,
      prongMetal,
      value.basketHalo,
    ],
  );

  function choose(panelId: string, groupIdx: number, choiceIdx: number) {
    if (panelId === "metal" && groupIdx === 0) set.setMetalIdx(choiceIdx);
    else if (panelId === "diamonds" && groupIdx === 0) set.setStoneIdx(choiceIdx);
    else if (panelId === "diamonds" && groupIdx === 1)
      set.setDiamondType(choiceIdx === 1 ? "Lab Grown" : "Natural");
    else if (panelId === "head" && groupIdx === 0)
      set.setBasketHalo(BASKET_HALOS[choiceIdx].id);
    else if (panelId === "head" && groupIdx === 1)
      set.setProngCount(prongCountOptions[choiceIdx]);
    else if (panelId === "head" && groupIdx === 2)
      set.setProngTip(PRONG_TIPS[choiceIdx].id);
    else if (panelId === "head" && groupIdx === 3) set.setProngPave(choiceIdx === 1);
    else if (panelId === "head" && groupIdx === 4)
      set.setProngMetalIdx(choiceIdx === 0 ? null : choiceIdx - 1);
    else if (panelId === "band" && groupIdx === 0)
      set.setBandStyle(BAND_STYLES[choiceIdx]);
    else if (panelId === "band" && groupIdx === 1)
      set.setCathedral(choiceIdx === 1);
    else if (panelId === "band" && groupIdx === 2)
      set.setBandPave(choiceIdx === 1);
    else if (panelId === "band" && groupIdx === 3)
      set.setBandFit(BAND_FITS[choiceIdx]);
    else if (panelId === "band" && groupIdx === 4)
      set.setBandPaveLength(BAND_PAVE_LENGTHS[choiceIdx]);
    else if (panelId === "more" && groupIdx === 0)
      set.setEngravingFont(choiceIdx === 1 ? "Cursive" : "Block");
    else if (panelId === "more" && groupIdx === 1)
      set.setSurpriseStones(choiceIdx === 1);
  }

  function activeChoice(panel: Panel, groupIdx: number, group: Group): number {
    if (panel.id === "metal" && groupIdx === 0) return value.metalIdx;
    if (panel.id === "diamonds" && groupIdx === 0) return value.stoneIdx;
    if (panel.id === "diamonds" && groupIdx === 1)
      return value.diamondType === "Lab Grown" ? 1 : 0;
    if (panel.id === "head" && groupIdx === 0)
      return Math.max(0, BASKET_HALOS.findIndex((b) => b.id === value.basketHalo));
    if (panel.id === "head" && groupIdx === 1)
      return Math.max(0, prongCountOptions.indexOf(activeProngCount));
    if (panel.id === "head" && groupIdx === 2)
      return Math.max(0, PRONG_TIPS.findIndex((t) => t.id === value.prongTip));
    if (panel.id === "head" && groupIdx === 3) return value.prongPave ? 1 : 0;
    if (panel.id === "head" && groupIdx === 4)
      return value.prongMetalIdx === null ? 0 : value.prongMetalIdx + 1;
    if (panel.id === "band" && groupIdx === 0)
      return Math.max(0, BAND_STYLES.indexOf(value.bandStyle));
    if (panel.id === "band" && groupIdx === 1) return value.cathedral ? 1 : 0;
    if (panel.id === "band" && groupIdx === 2) return value.bandPave ? 1 : 0;
    if (panel.id === "band" && groupIdx === 3)
      return Math.max(0, BAND_FITS.indexOf(value.bandFit));
    if (panel.id === "band" && groupIdx === 4)
      return Math.max(0, BAND_PAVE_LENGTHS.indexOf(value.bandPaveLength));
    if (panel.id === "more" && groupIdx === 0)
      return value.engravingFont === "Cursive" ? 1 : 0;
    if (panel.id === "more" && groupIdx === 1) return value.surpriseStones ? 1 : 0;
    return group.selected;
  }

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
            {panels.map((panel) => {
              const isOpen = open === panel.id;
              return (
                <div
                  key={panel.id}
                  className="overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : panel.id)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 text-neutral-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d={panel.icon} />
                      </svg>
                      <span className="text-[15px] text-neutral-900">
                        {panel.label}
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
                    <div className="space-y-4 border-t border-neutral-100 px-4 py-3.5">
                      {panel.groups.map((group, gi) => {
                        const active = activeChoice(panel, gi, group);
                        return (
                          <div key={group.label}>
                            <div className="text-[13px] font-medium text-neutral-900">
                              {group.label}
                            </div>
                            {group.hint && (
                              <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                                {group.hint}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {group.choices.map((c, ci) => (
                                <button
                                  key={c.label}
                                  onClick={() => choose(panel.id, gi, ci)}
                                  className={`rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
                                    active === ci
                                      ? "border-neutral-900 bg-neutral-900 text-white"
                                      : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                                  }`}
                                >
                                  {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {panel.id === "diamonds" && (
                        <div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[13px] font-medium text-neutral-900">
                              Carat Weight
                            </span>
                            <span className="text-[12px] text-neutral-500">
                              {value.carat.toFixed(2)} ct
                            </span>
                          </div>
                          <input
                            type="range"
                            min={caratRange.min}
                            max={caratRange.max}
                            step={0.05}
                            value={value.carat}
                            onChange={(e) => set.setCarat(+e.target.value)}
                            className="mt-2 w-full accent-neutral-900"
                          />
                        </div>
                      )}

                      {panel.id === "band" && (
                        <>
                          <div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-[13px] font-medium text-neutral-900">
                                Band Width
                              </span>
                              <span className="text-[12px] text-neutral-500">
                                {value.bandWidth.toFixed(1)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1.5}
                              max={4}
                              step={0.1}
                              value={value.bandWidth}
                              onChange={(e) => set.setBandWidth(+e.target.value)}
                              className="mt-2 w-full accent-neutral-900"
                            />
                          </div>
                          <div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-[13px] font-medium text-neutral-900">
                                Ring Size (US)
                              </span>
                              <span className="text-[12px] text-neutral-500">
                                {value.ringSize.toFixed(2)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                              Ring sizes are presented in US/Canada standard sizing
                            </div>
                            <input
                              type="range"
                              min={3}
                              max={13}
                              step={0.25}
                              value={value.ringSize}
                              onChange={(e) => set.setRingSize(+e.target.value)}
                              className="mt-2 w-full accent-neutral-900"
                            />
                          </div>
                        </>
                      )}

                      {panel.id === "more" && (
                        <div>
                          <div className="text-[13px] font-medium text-neutral-900">
                            Add Engraving
                          </div>
                          <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                            Type a custom message for engraving (14 characters max)
                          </div>
                          <input
                            type="text"
                            maxLength={14}
                            value={value.engravingText}
                            onChange={(e) => set.setEngravingText(e.target.value)}
                            className="mt-2 w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-neutral-900"
                          />
                        </div>
                      )}
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
