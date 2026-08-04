import type { ReactNode } from "react";
import type { BandFit, BandStyle } from "@/lib/settings/bandGeometry";
import type { BandPaveLength } from "@/lib/settings/bandPave";
import type { BasketHaloId } from "@/lib/settings/basketHalo";
import type { ProngCount, ProngTipId } from "@/lib/settings/prongs";

/**
 * Display-only in the current build — the vendor's configurator tints its option text by
 * this but renders the same geometry either way. Held in state so the review sheet can
 * report it; it drives nothing in RingScene.
 */
export type DiamondType = "Natural" | "Lab Grown";

export type EngravingFont = "Block" | "Cursive";

/** Every ring choice, by name. Replaces the positional `selections` record. */
export type RingValue = {
  metalIdx: number;
  stoneIdx: number;
  carat: number;
  diamondType: DiamondType;
  basketHalo: BasketHaloId;
  prongCount: ProngCount;
  prongTip: ProngTipId;
  prongPave: boolean;
  /** null = prongs follow the band. The configurator calls a split "Mixed". */
  prongMetalIdx: number | null;
  bandStyle: BandStyle;
  cathedral: boolean;
  bandPave: boolean;
  bandPaveLength: BandPaveLength;
  bandFit: BandFit;
  bandWidth: number;
  ringSize: number;
  engravingFont: EngravingFont;
  engravingText: string;
  surpriseStones: boolean;
};

/** The four orbit angles the review sheet shows, in display order. */
export const RING_VIEWS = ["front", "side", "top", "bottom"] as const;
export type RingView = (typeof RING_VIEWS)[number];

/** One PNG data URL per view, produced in a single synchronous capture pass. */
export type RingShots = Record<RingView, string>;

export type SwatchOption = { id: string; label: string; hex: string };
export type IconOption = { id: string; label: string; svg: string };
export type TextOption = { id: string; label: string };

/**
 * The render discriminant. The previous schema was `{ label, choices: { label }[] }`,
 * which could only describe text chips — which is exactly why a metal colour and a
 * diamond shape rendered identically.
 */
export type Control =
  | { kind: "swatch"; options: SwatchOption[]; value: string; onChange: (id: string) => void }
  | { kind: "shape"; options: IconOption[]; value: string; onChange: (id: string) => void }
  | { kind: "chip"; options: TextOption[]; value: string; onChange: (id: string) => void }
  | { kind: "segmented"; options: TextOption[]; value: string; onChange: (id: string) => void }
  | { kind: "switch"; value: boolean; onChange: (next: boolean) => void }
  | {
      kind: "range";
      min: number;
      max: number;
      step: number;
      value: number;
      presets?: number[];
      format: (n: number) => string;
      onChange: (next: number) => void;
    }
  | {
      kind: "text";
      maxLength: number;
      value: string;
      onChange: (next: string) => void;
    };

export type ControlGroupModel = {
  id: string;
  label: string;
  hint?: string;
  control: Control;
};

export type Category = {
  id: string;
  label: string;
  icon: ReactNode;
  groups: ControlGroupModel[];
};
