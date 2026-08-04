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
