import type { Stone } from "./types";
import { stoneDimensionsAtCarat } from "./geometry";

/**
 * Prong head configuration, ported from the configurator's own logic.
 *
 * The vendor keeps prong state as `{ prongCount, prongTip, prongPave, prongMetalColor,
 * prongArm }` and defaults it to
 * `{ prongCount: "4 Classic", prongTip: "Claw", prongPave: false, prongMetalColor: "18K Yellow",
 *    prongArm: "Straight" }`.
 */

export type ProngCount =
  | "3 Prong"
  | "4 Classic"
  | "4 Compass"
  | "5 Prong"
  | "6 Prong";

/**
 * Prong azimuths in degrees, per stone shape and layout — a direct port of the vendor's
 * angle table. Several shapes derive their "classic" angle from the stone's own
 * proportions so the prongs land on the corners rather than at fixed positions, which is
 * why this needs the stone's millimetre length and width.
 *
 * `length` and `width` are the stone's dimensions at its current carat.
 */
function angleTable(
  shape: string,
  length: number,
  width: number,
): Partial<Record<ProngCount, number[]>> {
  const deg = (rad: number) => rad * (180 / Math.PI);

  /** Corner angle for a rounded-rectangle outline inset by `inset` on each side. */
  const cornerAngle = (inset: number) =>
    deg(Math.atan((width - 2 * inset) / (length - 2 * inset)));

  /** The four corners of a rectangular outline, mirrored into each quadrant. */
  const quad = (a: number) => [a, 180 - a, 180 + a, 360 - a];

  switch (shape) {
    case "Round":
      return {
        "4 Classic": [45, 135, 225, 315],
        "4 Compass": [0, 90, 180, 270],
        "6 Prong": [0, 60, 120, 180, 240, 300],
      };

    case "Oval": {
      const a = deg(Math.atan(width / length));
      return {
        "4 Classic": quad(a),
        "4 Compass": [0, 90, 180, 270],
        "6 Prong": [0, 60, 120, 180, 240, 300],
      };
    }

    case "Princess": {
      const a = deg(Math.atan(width / length));
      return { "4 Classic": quad(a) };
    }

    case "Cushion": {
      const a = cornerAngle(0.211 * width * 0.5);
      return { "4 Classic": quad(a), "4 Compass": [0, 90, 180, 270] };
    }

    case "Emerald": {
      const a = cornerAngle(0.202 * width * 0.5);
      return { "4 Classic": quad(a), "4 Compass": [0, 90, 180, 270] };
    }

    case "Radiant": {
      const a = cornerAngle(0.176 * width * 0.5);
      return { "4 Classic": quad(a), "4 Compass": [0, 90, 180, 270] };
    }

    case "Asscher": {
      const a = cornerAngle(0.183 * width * 0.5);
      return { "4 Classic": quad(a), "4 Compass": [0, 90, 180, 270] };
    }

    case "Pear": {
      // The point gets a prong of its own at 0°; the rest cradle the belly.
      const a = deg(Math.atan((0.44515 * width) / (2 * (length - width / 2) * 0.20304)));
      return {
        "3 Prong": [0, 135, 225],
        "5 Prong": [0, 90 - a, 135, 225, 270 + a],
      };
    }

    case "Marquise": {
      const a = deg(Math.atan((0.44515 * width) / (0.18304 * length)));
      return { "6 Prong": [0, a, 180 - a, 180, 180 + a, 360 - a] };
    }

    case "Heart": {
      const a = deg(Math.atan((0.40312 * width) / (0.27134 * length)));
      const b = deg(Math.atan((0.33215 * width) / (0.35981 * length)));
      return {
        "3 Prong": [a, 180, 360 - a],
        "5 Prong": [90 - a, 90 + b, 180, 270 - b, 270 + a],
      };
    }

    default:
      return {
        "4 Classic": [45, 135, 225, 315],
        "4 Compass": [0, 90, 180, 270],
      };
  }
}

/** Which prong layouts a shape supports. Marquise only takes six, Princess only four. */
export function prongCountsFor(
  stone: Stone,
  carat: number,
): ProngCount[] {
  const d = stoneDimensionsAtCarat(stone, carat);
  return Object.keys(angleTable(stone.name, d.length, d.width)) as ProngCount[];
}

/** Prong azimuths in radians for the current stone and layout. */
export function prongAngles(
  stone: Stone,
  carat: number,
  count: ProngCount,
): number[] {
  const d = stoneDimensionsAtCarat(stone, carat);
  const table = angleTable(stone.name, d.length, d.width);
  const degrees = table[count] ?? Object.values(table)[0] ?? [];
  return degrees.map((a) => a * (Math.PI / 180));
}

/** Falls back to the shape's first supported layout when the current one doesn't apply. */
export function resolveProngCount(
  stone: Stone,
  carat: number,
  wanted: ProngCount,
): ProngCount {
  const available = prongCountsFor(stone, carat);
  return available.includes(wanted) ? wanted : available[0];
}

/**
 * The four prong tips the configurator actually offers. Its API returns seven, but the app
 * filters out `Bezel`, `Double Claw` and `Double Petite` — those three point at a
 * placeholder `Cube.glb`, so they have no geometry to show.
 */
export const PRONG_TIPS = [
  { id: "Rounded", label: "Rounded", model: "/models/RoundTip.glb" },
  { id: "Claw", label: "Claw", model: "/models/ClawTip.glb" },
  { id: "Petite Claw", label: "Petite Claw", model: "/models/PetiteClawTip.glb" },
  { id: "Tab", label: "Tab", model: "/models/TabTip.glb" },
] as const;

export type ProngTipId = (typeof PRONG_TIPS)[number]["id"];

export function prongTipModel(id: string): string {
  return PRONG_TIPS.find((t) => t.id === id)?.model ?? PRONG_TIPS[1].model;
}

export const DEFAULT_PRONG_COUNT: ProngCount = "4 Classic";
export const DEFAULT_PRONG_TIP: ProngTipId = "Claw";
