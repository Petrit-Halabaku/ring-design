/**
 * The settings API hands back absolute S3 URLs
 * (`https://jeweleros.s3.us-east-1.amazonaws.com/glb/RoundDiamond.glb`) and the app
 * bundle resolves its band/head parts relative to the site root (`../test/band/...`).
 *
 * Both are mirrored under /public/models here, so this maps a remote URL to the local copy.
 */

/** Models mirrored locally; anything else falls back to the round brilliant. */
const AVAILABLE = new Set([
  "RoundDiamond",
  "OvalDiamond",
  "PrincessDiamond",
  "EmeraldDiamond",
  "CushionDiamond",
  "RadiantDiamond",
  "PearDiamond",
  "MarquiseDiamond",
  "AsscherDiamond",
  "ClawTip",
]);

/** One bead of a Petite French pavé run, and the handed pieces that cap each end. */
export const BAND_PAVE_MIDDLE = "/models/test/band/Band0.22V2.glb";
export const BAND_PAVE_OPEN_LEFT = "/models/test/band/Band0.22NoMetalLeft.glb";
export const BAND_PAVE_OPEN_RIGHT = "/models/test/band/Band0.22NoMetalRight.glb";
export const CATHEDRAL_BAND_MODEL = "/models/test/band/Cathedral0.22V3.glb";
export const PAVE_MODEL = "/models/DiamondPave.glb";

/** The pair of small stones set into the band's flanks. */
export const SURPRISE_STONE = "/models/test/SurpriseStone.glb";
export const BASKET_MODEL = "/models/using/basket/Block/RoundBlock0.15.glb";

const modelBaseName = (glbUrl: string) =>
  (glbUrl.split("/").pop() ?? "").replace(/\.glb$/i, "");

/**
 * Whether the model behind an API record was mirrored. The vendor's S3 serves
 * `HeartDiamond.glb` as 403, so that shape has no geometry to show and is filtered out of
 * the picker rather than silently falling back to a round.
 */
export function hasLocalModel(glbUrl: string): boolean {
  return AVAILABLE.has(modelBaseName(glbUrl));
}

/** `.../glb/RoundDiamond.glb` → `/models/RoundDiamond.glb` */
export function localModelUrl(glbUrl: string): string {
  const base = modelBaseName(glbUrl);
  return AVAILABLE.has(base)
    ? `/models/${base}.glb`
    : "/models/RoundDiamond.glb";
}

/** Wizard shape ids map onto the stone names returned by `stone/get-all`. */
export const SHAPE_TO_STONE_NAME: Record<string, string> = {
  round: "Round",
  oval: "Oval",
  cushion: "Cushion",
  emerald: "Emerald",
  princess: "Princess",
  asscher: "Asscher",
  marquise: "Marquise",
  pear: "Pear",
  radiant: "Radiant",
};

export const STONE_NAME_TO_SHAPE: Record<string, string> = Object.fromEntries(
  Object.entries(SHAPE_TO_STONE_NAME).map(([shape, name]) => [name, shape]),
);
