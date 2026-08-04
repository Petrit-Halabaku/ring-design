"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRingSettings, SNAPSHOT } from "@/lib/settings/client";
import { hasLocalModel, SHAPE_TO_STONE_NAME } from "@/lib/settings/models";
import {
  DEFAULT_PRONG_COUNT,
  DEFAULT_PRONG_TIP,
  prongAngles,
  prongCountsFor,
  resolveProngCount,
} from "@/lib/settings/prongs";
import { DEFAULT_BASKET_HALO, type BasketHaloId } from "@/lib/settings/basketHalo";
import type { RingSettings } from "@/lib/settings/types";
import type { RingValue } from "./types";

export type RingConfigInit = { shapeId?: string; carat?: number };

const DEFAULTS = {
  carat: 1,
  diamondType: "Natural",
  bandStyle: "Round",
  cathedral: false,
  bandPave: false,
  bandPaveLength: "Half",
  bandFit: "Comfort Fit",
  bandWidth: 1.7,
  ringSize: 6,
  engravingFont: "Block",
  engravingText: "",
  surpriseStones: false,
} as const;

export function useRingConfig({ shapeId, carat: initialCarat }: RingConfigInit) {
  const [settings, setSettings] = useState<RingSettings>(SNAPSHOT);

  const [value, setValue] = useState<RingValue>(() => ({
    // 18K Yellow is the configurator's default.
    metalIdx: Math.max(0, SNAPSHOT.metals.findIndex((m) => m.uiValue === "18K Yellow")),
    // Indexes into the filtered list the picker renders, not the raw API order.
    stoneIdx: Math.max(
      0,
      SNAPSHOT.stones
        .filter((s) => hasLocalModel(s.glbUrl))
        .findIndex((s) => s.name === (shapeId ? SHAPE_TO_STONE_NAME[shapeId] : "Round")),
    ),
    carat: initialCarat ?? DEFAULTS.carat,
    diamondType: DEFAULTS.diamondType,
    basketHalo: DEFAULT_BASKET_HALO,
    prongCount: DEFAULT_PRONG_COUNT,
    prongTip: DEFAULT_PRONG_TIP,
    prongPave: false,
    prongMetalIdx: null,
    bandStyle: DEFAULTS.bandStyle,
    cathedral: DEFAULTS.cathedral,
    bandPave: DEFAULTS.bandPave,
    bandPaveLength: DEFAULTS.bandPaveLength,
    bandFit: DEFAULTS.bandFit,
    bandWidth: DEFAULTS.bandWidth,
    ringSize: DEFAULTS.ringSize,
    engravingFont: DEFAULTS.engravingFont,
    engravingText: DEFAULTS.engravingText,
    surpriseStones: DEFAULTS.surpriseStones,
  }));

  // The live app fetches every settings endpoint on boot; the snapshot seeds the first
  // paint so the canvas never waits on a cold Render dyno.
  useEffect(() => {
    const ac = new AbortController();
    fetchRingSettings(ac.signal).then(setSettings).catch(() => {});
    return () => ac.abort();
  }, []);

  const patch = useCallback(
    <K extends keyof RingValue>(k: K, v: RingValue[K]) =>
      setValue((prev) => {
        const next = { ...prev, [k]: v };
        // Switching a cathedral on with a bare head fits a basket for the shoulders to
        // land on. Ported from the vendor's handler, which reads
        // `"None" !== e && "None" === basketHalo` — so it only fills an empty choice.
        // A halo, bezel or hidden halo already gives the shoulders something to meet.
        if (k === "cathedral" && v === true && prev.basketHalo === "None") {
          next.basketHalo = "Basket" as BasketHaloId;
        }
        return next;
      }),
    [],
  );

  // Only offer shapes whose GLB is actually available (see hasLocalModel).
  const stones = useMemo(
    () => settings.stones.filter((s) => hasLocalModel(s.glbUrl)),
    [settings.stones],
  );
  const stone = stones[value.stoneIdx] ?? stones[0] ?? SNAPSHOT.stones[0];
  const metal = settings.metals[value.metalIdx] ?? SNAPSHOT.metals[0];
  const prongMetal =
    value.prongMetalIdx === null
      ? metal
      : (settings.metals[value.prongMetalIdx] ?? metal);

  // Layouts depend on the shape: a marquise only takes six prongs, a princess only four,
  // and a pear takes three or five. Keep the selection valid as the shape changes.
  const prongCountOptions = useMemo(
    () => prongCountsFor(stone, value.carat),
    [stone, value.carat],
  );
  const activeProngCount = resolveProngCount(stone, value.carat, value.prongCount);
  const angles = useMemo(
    () => prongAngles(stone, value.carat, activeProngCount),
    [stone, value.carat, activeProngCount],
  );

  const set = useMemo(
    () => ({
      setMetalIdx: (v: number) => patch("metalIdx", v),
      setStoneIdx: (v: number) => patch("stoneIdx", v),
      setCarat: (v: number) => patch("carat", v),
      setDiamondType: (v: RingValue["diamondType"]) => patch("diamondType", v),
      setBasketHalo: (v: RingValue["basketHalo"]) => patch("basketHalo", v),
      setProngCount: (v: RingValue["prongCount"]) => patch("prongCount", v),
      setProngTip: (v: RingValue["prongTip"]) => patch("prongTip", v),
      setProngPave: (v: boolean) => patch("prongPave", v),
      setProngMetalIdx: (v: number | null) => patch("prongMetalIdx", v),
      setBandStyle: (v: RingValue["bandStyle"]) => patch("bandStyle", v),
      setCathedral: (v: boolean) => patch("cathedral", v),
      setBandPave: (v: boolean) => patch("bandPave", v),
      setBandPaveLength: (v: RingValue["bandPaveLength"]) => patch("bandPaveLength", v),
      setBandFit: (v: RingValue["bandFit"]) => patch("bandFit", v),
      setBandWidth: (v: number) => patch("bandWidth", v),
      setRingSize: (v: number) => patch("ringSize", v),
      setEngravingFont: (v: RingValue["engravingFont"]) => patch("engravingFont", v),
      setEngravingText: (v: string) => patch("engravingText", v),
      setSurpriseStones: (v: boolean) => patch("surpriseStones", v),
    }),
    [patch],
  );

  return {
    settings,
    stones,
    stone,
    metal,
    prongMetal,
    caratRange: settings.caratWeights.solitaire.center,
    prongCountOptions,
    activeProngCount,
    angles,
    value,
    set,
  };
}

export type RingConfig = ReturnType<typeof useRingConfig>;
