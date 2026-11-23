import { BAND_FITS, BAND_STYLES } from "@/lib/settings/bandGeometry";
import { BAND_PAVE_LENGTHS } from "@/lib/settings/bandPave";
import { BASKET_HALOS } from "@/lib/settings/basketHalo";
import { ENGRAVING_FONTS, ENGRAVING_MAX } from "@/lib/settings/engraving";
import { hasLocalModel } from "@/lib/settings/models";
import { PRONG_TIPS, resolveProngCount, type ProngCount } from "@/lib/settings/prongs";
import type { RingSettings } from "@/lib/settings/types";
import { encodeConfig } from "./shareCodec";
import type { RingValue } from "./types";

const PRONG_COUNTS = ["3 Prong", "4 Classic", "4 Compass", "5 Prong", "6 Prong"] as const satisfies readonly ProngCount[];
const BASKET_IDS = BASKET_HALOS.map(({ id }) => id);
const TIP_IDS = PRONG_TIPS.map(({ id }) => id);
const FONT_IDS = Object.keys(ENGRAVING_FONTS);

const inRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" && value >= min && value <= max;
const isIndex = (value: unknown, length: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length;
const oneOf = (value: unknown, options: readonly string[]) =>
  typeof value === "string" && options.includes(value);
const isBoolean = (value: unknown) => typeof value === "boolean";
const yesNo = (value: boolean) => (value ? "Yes" : "No");

export function buildDesignEmail(input: unknown, settings: RingSettings, origin: URL) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const stones = settings.stones.filter(({ glbUrl }) => hasLocalModel(glbUrl));
  const carats = settings.caratWeights.solitaire.center;
  const fields: Record<keyof RingValue, (value: unknown) => boolean> = {
    metalIdx: (value) => isIndex(value, settings.metals.length),
    stoneIdx: (value) => isIndex(value, stones.length),
    carat: (value) => inRange(value, carats.min, carats.max),
    diamondType: (value) => oneOf(value, ["Natural", "Lab Grown"]),
    basketHalo: (value) => oneOf(value, BASKET_IDS),
    prongCount: (value) => oneOf(value, PRONG_COUNTS),
    prongTip: (value) => oneOf(value, TIP_IDS),
    prongPave: isBoolean,
    prongMetalIdx: (value) => value === null || isIndex(value, settings.metals.length),
    bandStyle: (value) => oneOf(value, BAND_STYLES),
    cathedral: isBoolean,
    bandPave: isBoolean,
    bandPaveLength: (value) => oneOf(value, BAND_PAVE_LENGTHS),
    bandFit: (value) => oneOf(value, BAND_FITS),
    bandWidth: (value) => inRange(value, 1.5, 4),
    ringSize: (value) => inRange(value, 3, 13),
    engravingFont: (value) => oneOf(value, FONT_IDS),
    engravingText: (value) => typeof value === "string" && value.length <= ENGRAVING_MAX,
    surpriseStones: isBoolean,
  };

  const entries = Object.entries(fields);
  const values = input as Record<string, unknown>;
  if (
    Object.keys(values).length !== entries.length ||
    !entries.every(([key, validate]) => Object.hasOwn(values, key) && validate(values[key]))
  ) {
    return null;
  }
  const design = values as RingValue;

  const metal = settings.metals[design.metalIdx].uiValue;
  const stone = stones[design.stoneIdx];
  const basket = BASKET_HALOS.find(({ id }) => id === design.basketHalo)?.label ?? design.basketHalo;
  const tip = PRONG_TIPS.find(({ id }) => id === design.prongTip)?.label ?? design.prongTip;
  const prongCount = resolveProngCount(stone, design.carat, design.prongCount) ?? design.prongCount;
  const prongMetal = design.prongMetalIdx === null
    ? `Match band (${metal})`
    : settings.metals[design.prongMetalIdx].uiValue;
  const designUrl = new URL(`/${encodeConfig(design)}`, origin).href;

  return {
    from_name: "Ring Selection",
    design_url: designUrl,
    message: [
      `Metal: ${metal}`,
      `Center stone: ${stone.name}`,
      `Carat weight: ${design.carat.toFixed(2)} ct`,
      `Diamond type: ${design.diamondType}`,
      `Basket and halo: ${basket}`,
      `Prong count: ${prongCount}`,
      `Prong tips: ${tip}`,
      `Prong pavé: ${yesNo(design.prongPave)}`,
      `Prong metal: ${prongMetal}`,
      `Band style: ${design.bandStyle}`,
      `Cathedral: ${yesNo(design.cathedral)}`,
      `Band pavé: ${yesNo(design.bandPave)}`,
      `Band pavé length: ${design.bandPaveLength}${design.bandPave ? "" : " (inactive)"}`,
      `Band fit: ${design.bandFit}`,
      `Band width: ${design.bandWidth.toFixed(1)} mm`,
      `Ring size (US/CA): ${design.ringSize.toFixed(2)}`,
      `Engraving: ${design.engravingText || "None"}`,
      `Engraving font: ${design.engravingFont}`,
      `Surprise stones: ${yesNo(design.surpriseStones)}`,
      "",
      `Open this design: ${designUrl}`,
    ].join("\n"),
  };
}
