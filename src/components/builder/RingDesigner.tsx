"use client";

import { useEffect, useMemo, useState } from "react";
import RingViewer from "@/components/three/RingViewer";
import { fetchRingSettings, SNAPSHOT } from "@/lib/settings/client";
import {
  hasLocalModel,
  localModelUrl,
  SHAPE_TO_STONE_NAME,
} from "@/lib/settings/models";
import type { RingSettings } from "@/lib/settings/types";

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
    id: "head",
    label: "Head",
    icon: "M12 3l3 5H9zM5 10h14l-7 11z",
    groups: [
      {
        label: "Prong Count",
        hint: "4 Prong Classic Setting",
        selected: 0,
        choices: [
          { label: "4 Classic" },
          { label: "4 Compass" },
          { label: "6 Prong" },
        ],
      },
      {
        label: "Prong Pave",
        hint: "Plain prong arms",
        selected: 0,
        choices: [{ label: "None" }, { label: "Pave" }],
      },
    ],
  },
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

const METAL_ICON = "M12 2l4 6-4 14L8 8z";
const DIAMOND_ICON = "M6 3h12l4 6-10 12L2 9z";

export type DesignerProps = {
  /** Wizard selections, if the walkthrough ran. */
  shapeId?: string;
  carat?: number;
};

export default function RingDesigner({ shapeId, carat: initialCarat }: DesignerProps) {
  const [settings, setSettings] = useState<RingSettings>(SNAPSHOT);
  const [open, setOpen] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [bandWidth, setBandWidth] = useState(1.8);
  const [ringSize, setRingSize] = useState(6.5);
  const [engraving, setEngraving] = useState("");
  const [carat, setCarat] = useState(initialCarat ?? 1);

  const [stoneIdx, setStoneIdx] = useState(() => {
    const wanted = shapeId ? SHAPE_TO_STONE_NAME[shapeId] : "Round";
    // Indexes into the filtered list the picker renders, not the raw API order.
    const i = SNAPSHOT.stones
      .filter((s) => hasLocalModel(s.glbUrl))
      .findIndex((s) => s.name === wanted);
    return i >= 0 ? i : 0;
  });
  // 18K Yellow is the configurator's default.
  const [metalIdx, setMetalIdx] = useState(() =>
    Math.max(
      0,
      SNAPSHOT.metals.findIndex((m) => m.uiValue === "18K Yellow"),
    ),
  );

  // The live app fetches every settings endpoint on boot; the snapshot seeds the
  // first paint so the canvas never waits on a cold Render dyno.
  useEffect(() => {
    const ac = new AbortController();
    fetchRingSettings(ac.signal).then(setSettings).catch(() => {});
    return () => ac.abort();
  }, []);

  // Only offer shapes whose GLB is actually available (see hasLocalModel).
  const stones = useMemo(
    () => settings.stones.filter((s) => hasLocalModel(s.glbUrl)),
    [settings.stones],
  );
  const stone = stones[stoneIdx] ?? stones[0] ?? SNAPSHOT.stones[0];
  const metal = settings.metals[metalIdx] ?? SNAPSHOT.metals[0];
  const caratRange = settings.caratWeights.solitaire.center;

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
            selected: metalIdx,
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
            hint: `Center: ${carat} carat ${stone.name}`,
            selected: stoneIdx,
            choices: stones.map((s) => ({ label: s.name })),
          },
          {
            label: "Diamond Type",
            hint: "Natural diamond center stones & pave (if applicable)",
            selected: 0,
            choices: [{ label: "Natural" }, { label: "Lab Grown" }],
          },
        ],
      },
      ...STATIC_PANELS,
    ],
    [settings.metals, stones, metal, metalIdx, stone, stoneIdx, carat],
  );

  const key = (panelId: string, groupIdx: number) => `${panelId}-${groupIdx}`;

  function choose(panelId: string, groupIdx: number, choiceIdx: number) {
    if (panelId === "metal" && groupIdx === 0) setMetalIdx(choiceIdx);
    else if (panelId === "diamonds" && groupIdx === 0) setStoneIdx(choiceIdx);
    else setSelections((s) => ({ ...s, [key(panelId, groupIdx)]: choiceIdx }));
  }

  function activeChoice(panel: Panel, groupIdx: number, group: Group) {
    if (panel.id === "metal" && groupIdx === 0) return metalIdx;
    if (panel.id === "diamonds" && groupIdx === 0) return stoneIdx;
    return selections[key(panel.id, groupIdx)] ?? group.selected;
  }

  return (
    <div className="customizer-container">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[linear-gradient(160deg,#f4f4f4_0%,#e9e9e9_45%,#dedede_100%)]">
        {/* Ring stage — real GLB models, same pipeline as the original */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="absolute inset-0">
            <RingViewer
              stone={stone}
              stoneModel={localModelUrl(stone.glbUrl)}
              carat={carat}
              metalColor={metal.material.color}
              ringSize={ringSize}
              bandWidthMm={bandWidth}
            />
          </div>

          {/* Option panels */}
          <div className="absolute inset-x-3 bottom-3 z-10 max-h-[45%] space-y-2 overflow-y-auto md:inset-x-auto md:right-4 md:top-4 md:bottom-auto md:max-h-[calc(100%-2rem)] md:w-[280px]">
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
                              {carat.toFixed(2)} ct
                            </span>
                          </div>
                          <input
                            type="range"
                            min={caratRange.min}
                            max={caratRange.max}
                            step={0.05}
                            value={carat}
                            onChange={(e) => setCarat(+e.target.value)}
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
                                {bandWidth.toFixed(1)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1.5}
                              max={4}
                              step={0.1}
                              value={bandWidth}
                              onChange={(e) => setBandWidth(+e.target.value)}
                              className="mt-2 w-full accent-neutral-900"
                            />
                          </div>
                          <div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-[13px] font-medium text-neutral-900">
                                Ring Size (US)
                              </span>
                              <span className="text-[12px] text-neutral-500">
                                {ringSize.toFixed(1)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                              Ring sizes are presented in US/Canada standard sizing
                            </div>
                            <input
                              type="range"
                              min={3}
                              max={13}
                              step={0.5}
                              value={ringSize}
                              onChange={(e) => setRingSize(+e.target.value)}
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
                            value={engraving}
                            onChange={(e) => setEngraving(e.target.value)}
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
