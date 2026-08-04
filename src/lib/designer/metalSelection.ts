import type { MetalColor } from "@/lib/settings/types";
import type { SwatchOption } from "./types";

export type MetalColourId = "Yellow" | "White" | "Rose" | "Platinum";
export type MetalKaratId = "14K" | "18K";

const COLOUR_ORDER: MetalColourId[] = ["Yellow", "White", "Rose", "Platinum"];

export function parseMetalUiValue(uiValue: string): {
  colour: MetalColourId;
  karat: MetalKaratId | null;
} {
  if (uiValue === "Platinum") return { colour: "Platinum", karat: null };
  const karat: MetalKaratId = uiValue.startsWith("14K") ? "14K" : "18K";
  if (uiValue.endsWith("Yellow")) return { colour: "Yellow", karat };
  if (uiValue.endsWith("White")) return { colour: "White", karat };
  if (uiValue.endsWith("Rose")) return { colour: "Rose", karat };
  return { colour: "Yellow", karat: "18K" };
}

/** One swatch per colour family; hex from a representative metal record. */
export function metalColourOptions(metals: MetalColor[]): SwatchOption[] {
  return COLOUR_ORDER.map((colour) => {
    const sample =
      colour === "Platinum"
        ? metals.find((m) => m.uiValue === "Platinum")
        : metals.find((m) => m.uiValue.endsWith(colour));
    return {
      id: colour,
      label: colour,
      hex: sample?.backgroundColor ?? "#B0B0B0",
    };
  });
}

/** Gold→gold keeps karat; Platinum→gold defaults to 18K. */
export function resolveMetalByColour(
  metals: MetalColor[],
  colour: MetalColourId,
  currentUiValue: string,
): string {
  if (colour === "Platinum") return "Platinum";
  const { karat } = parseMetalUiValue(currentUiValue);
  const nextKarat: MetalKaratId = karat ?? "18K";
  const uiValue = `${nextKarat} ${colour}`;
  return metals.some((m) => m.uiValue === uiValue) ? uiValue : `18K ${colour}`;
}

export function resolveMetalByKarat(
  metals: MetalColor[],
  karat: MetalKaratId,
  currentUiValue: string,
): string {
  const { colour } = parseMetalUiValue(currentUiValue);
  if (colour === "Platinum") return currentUiValue;
  const uiValue = `${karat} ${colour}`;
  return metals.some((m) => m.uiValue === uiValue) ? uiValue : currentUiValue;
}
