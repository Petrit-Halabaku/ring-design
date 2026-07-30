/**
 * The configurator's prong-head solver, ported from its bundle.
 *
 * The shape of the thing matters more than any single number: **a prong is not placed at the
 * girdle and stood up vertically.** Every prong is mounted on the ring axis, at the top of
 * the band, and then *leaned outward* until its face meets the stone's girdle. That lean is
 * what makes the arms converge into the V under the stone, and it's the whole silhouette of
 * a solitaire head.
 *
 * The arm itself is not one stretched mesh either. It's a stack:
 *
 *     Bottom.glb  →  Middle{n}.glb  →  tip
 *
 * `Middle{n}` comes in whole 0.9mm segments (MIDDLE_SPANS), so the solver picks the largest
 * segment count that fits and stretches `Bottom.glb` to absorb the remainder. All three
 * parts are authored around a shared +y axis with `*Pointer*` locators marking the joins.
 *
 * Lengths here are in the parts' own authored units — the head is scaled by
 * `prongWidthAtCarat` at the end, which converts them to millimetres.
 */

/** Gap between the band's mounting face and the stone's culet, in mm. */
export const PRONG_CLEARANCE = 0.5;

/** How far the prong's base is sunk into the band, as a fraction of the prong width. */
export const PRONG_SEAT = 0.45;

/** The band's radial thickness the vendor assumes when seating a head, in mm. */
export const BAND_THICKNESS = 1.8;

/**
 * Fixed offset baked into the arm solve — the distance from the prong's own axis to the
 * face that actually touches the stone.
 */
const ARM_OFFSET = 0.2938;

/**
 * The vendor's reference diameter. It appears only as `(REF - 2) / (2 * REF)`, the fraction
 * of the prong's width that gets inset from the girdle.
 */
const REF_DIAMETER = 6.6;

/**
 * Cumulative span of `Middle{n}.glb` in authored units. The pieces step by 0.9mm, which is
 * also the parts' authored width.
 */
export const MIDDLE_SPANS: Record<number, number> = {
  0: 0,
  1: 1.0073,
  2: 1.9169,
  3: 2.8169,
  4: 3.7169,
  5: 4.6169,
  6: 5.5169,
  7: 6.4169,
};

/** With prong pavé the segments carry stones and the spans change. */
export const MIDDLE_SPANS_PAVE: Record<number, number> = {
  0: 0,
  1: 1.1265,
  2: 1.9786,
  3: 2.8461,
  4: 3.688,
  5: 4.529,
  6: 5.3701,
  7: 6.2111,
};

/**
 * Scale applied to the whole head. The parts are authored 0.9mm wide, so a 1ct stone's
 * 1.125 lands a 1.0125mm prong. Steps with the stone's diameter and caps at 1.3.
 */
export function prongWidthAtCarat(carat: number): number {
  const stepped = Math.min(Math.floor(10 * (0.8 + carat / 10)) / 10, 1.3);
  return (1.125 * stepped) / 0.9;
}

/**
 * Radial distance from the ring axis out to each prong's seat, in mm — the "a" side of the
 * triangle the arm solve works on.
 *
 * This is a *different* table from the azimuths in `./prongs`: several shapes inset their
 * corners so the prong grips the corner rather than the extreme point, and the compass
 * layouts sit on the flats instead. `angles` is only used for the shapes the vendor derives
 * from the outline directly.
 */
export function prongASides(
  shape: string,
  countType: string,
  angles: number[],
  length: number,
  width: number,
): number[] {
  const halfL = length / 2;
  const halfW = width / 2;

  /** Outline radius at an azimuth, treating the stone as an ellipse. */
  const ellipse = (t: number) =>
    (halfL * halfW) /
    Math.sqrt((halfW * Math.cos(t)) ** 2 + (halfL * Math.sin(t)) ** 2);

  /** Corner of a rectangular outline inset by a fraction of the half width. */
  const corner = (factor: number) => {
    const inset = factor * width * 0.5;
    return Math.hypot(halfW - inset, halfL - inset);
  };

  const compass = [halfL, halfW, halfL, halfW];
  const quad = (v: number) => [v, v, v, v];

  const table: Partial<Record<string, number[]>> = (() => {
    switch (shape) {
      case "Round": {
        const r = angles.map(() => halfW);
        return { "4 Classic": r, "4 Compass": r, "6 Prong": r };
      }
      case "Oval": {
        const c = angles.map(ellipse);
        return { "4 Classic": c, "4 Compass": c, "6 Prong": c };
      }
      case "Princess":
        return { "4 Classic": quad(Math.hypot(halfW, halfL)) };
      case "Cushion":
        return { "4 Classic": quad(corner(0.211)), "4 Compass": compass };
      case "Emerald":
        return { "4 Classic": quad(corner(0.2026)), "4 Compass": compass };
      case "Radiant":
        return { "4 Classic": quad(corner(0.15308)), "4 Compass": compass };
      case "Asscher":
        return { "4 Classic": quad(corner(0.15018)), "4 Compass": compass };
      case "Pear": {
        const tip = length - halfW;
        const flank = Math.hypot(0.44515 * width, 2 * tip * 0.20304);
        return {
          "3 Prong": [tip, halfW, halfW],
          "5 Prong": [tip, flank, halfW, halfW, flank],
        };
      }
      case "Marquise": {
        const flank = Math.hypot(0.44515 * width, 0.18304 * length);
        return { "6 Prong": [halfL, flank, flank, halfL, flank, flank] };
      }
      case "Heart": {
        const shoulder = Math.hypot(0.40312 * width, 0.27134 * length);
        const flank = Math.hypot(0.33215 * width, 0.35981 * length);
        const point = 0.6661 * length;
        return {
          "3 Prong": [shoulder, point, shoulder],
          "5 Prong": [shoulder, flank, point, flank, shoulder],
        };
      }
      default:
        return {};
    }
  })();

  const sides = table[countType];
  // Layouts the vendor's table doesn't cover fall back to the stone's own outline, which is
  // what it does for an oval anyway.
  return sides && sides.length === angles.length ? sides : angles.map(ellipse);
}

export type ProngArmSolve = {
  /** Lean away from vertical, in radians, before the arm's own skew is added. */
  angleOfApproach: number;
  /** Distance from the seat on the band out to the girdle, in mm. */
  armLength: number;
  /** Vertical rise the arm contributes. The tallest one sets the stone's height. */
  bSide: number;
};

/**
 * Solves the lean and length that put a prong's face on the girdle.
 *
 * The lean comes out of a quadratic in `cos(angle)`: the arm has to span `aSide` outward and
 * `pavHeight + clearance` upward while its own inset half-width stays tangent to the girdle.
 */
export function solveProngArm(
  aSide: number,
  clearance: number,
  prongWidth: number,
  pavHeight: number,
): ProngArmSolve {
  const rise = pavHeight + clearance;
  const inset = ((REF_DIAMETER - 2) / (2 * REF_DIAMETER)) * prongWidth - prongWidth / 2;

  const a = aSide ** 2 + rise ** 2;
  const b = 2 * aSide * inset;
  const c = inset ** 2 - rise ** 2;
  const root = Math.sqrt(b * b - 4 * a * c);
  const first = (-b + root) / (2 * a);
  const second = (-b - root) / (2 * a);
  const angleOfApproach = Math.acos(first > 0 ? first : second);

  const along =
    ((REF_DIAMETER - 2) * prongWidth) /
    (2 * REF_DIAMETER * Math.cos(angleOfApproach));
  const bSide = prongWidth / 2 / Math.sin(angleOfApproach);
  const armLength =
    Math.hypot(aSide + along, rise + bSide) - along * Math.sin(angleOfApproach);

  return { angleOfApproach, armLength, bSide };
}

export type ProngArmParts = {
  /** Which `Middle{n}.glb` to draw. */
  segments: number;
  /** Length to stretch `Bottom.glb` to, in authored units. */
  bottomLength: number;
  /** Total lean applied to the prong, in radians. Also picks the wedge tip. */
  tilt: number;
};

/**
 * Splits a solved arm into whole `Middle` segments plus a stretched `Bottom`.
 *
 * The `segments === 1` branch is the vendor's own: it re-solves against a shorter base and
 * then draws one segment *fewer* than the re-solve chose, while keeping the re-solve's
 * bottom length. That leaves the two slightly inconsistent, but it only triggers on very
 * short arms and it is reproduced here rather than second-guessed.
 */
export function splitProngArm(
  armLength: number,
  prongWidth: number,
  angleOfApproach: number,
  spans: Record<number, number> = MIDDLE_SPANS,
): ProngArmParts {
  const normalised = armLength / prongWidth;
  const straight = Math.sqrt(normalised ** 2 - ARM_OFFSET ** 2);
  const skew = Math.asin(ARM_OFFSET / normalised);
  const tilt = angleOfApproach + skew;

  const solve = (base: number) => {
    const usable = straight - 0.2 - base;
    let segments = 0;
    let span = 0;
    for (const [key, value] of Object.entries(spans)) {
      if (value < usable) {
        segments = Number(key);
        span = value;
      }
    }
    return { segments, bottomLength: usable - span + base };
  };

  const first = solve(1.1);
  if (first.segments !== 1) return { ...first, tilt };

  const retry = solve(0.3);
  return { segments: retry.segments - 1, bottomLength: retry.bottomLength, tilt };
}

/** Wedge tips are cut at 5° steps from 35° to 85°; the prong's lean picks one. */
export function wedgeTipAngle(tilt: number): number {
  const degrees = tilt * (180 / Math.PI);
  const buckets = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
  return buckets.find((b) => degrees <= b + 2.5) ?? 85;
}
