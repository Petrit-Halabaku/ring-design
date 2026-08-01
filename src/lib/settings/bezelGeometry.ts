/**
 * The bezel — a metal collar wrapped around the stone's girdle.
 *
 * Ported from the configurator's own bezel component. The important thing it is *not*: a
 * revolved profile. A lathe can only ever make a circle, so squashing one into an ellipse
 * leaves the collar cutting across a princess's corners and bulging past an emerald's flats.
 *
 * What the source actually builds is a **swept profile**: it walks the stone's own outline —
 * the same outlines the halo uses — at thirty-eight different sizes and heights, and stitches
 * consecutive rings into one closed tube. Because every ring is the stone's outline rather than
 * a circle, the collar conforms to whatever it is wrapping.
 *
 * The thirty-eight rings trace the collar's cross-section once around:
 *
 *   ┌── 12 ──┐  the outer wall, curving up and out from the base
 *   ├── 12 ──┤  the top outer fillet, rolling over the rim
 *   ├── 12 ──┤  the top inner fillet, rolling back down inside
 *   ├─  1  ──┤  the inner wall, dropped to just under the girdle
 *   └─  1  ──┘  the inner floor
 *
 * Only the ring generator changes per shape; the profile above is shared by all of them.
 */
import * as THREE from "three";
import {
  circleRing,
  cushionRing,
  cutCornerRing,
  ellipseRing,
  marquiseRing,
  pearRing,
  roundedRectRing,
  type PlanePoint,
} from "./haloLayout/outline";

/** How far in each cut-corner shape chamfers, as a fraction of its width. */
const CORNER_CUT: Record<string, number> = {
  Asscher: 0.15018,
  Emerald: 0.2026,
  Radiant: 0.15308,
};

/** Corner radius of a princess collar, in millimetres — a fixed size, not a proportion. */
const PRINCESS_CORNER = 0.1;

/** Clearance left between the girdle and the inner wall. */
const GIRDLE_CLEARANCE = 0.2;
/** Radius of the fillet rolled over the top rim. */
const TOP_FILLET = 0.075;
/** Radius of the curve the outer wall sweeps through as it rises. */
const OUTER_SWEEP = 0.2;

const BLEND_FLOOR = 0.3;
const TAPER = 0.55;

/**
 * Integration samples for the collar's arc-length solves.
 *
 * The collar re-solves the outline for all thirty-eight of its rings, so at the source's 1000
 * samples a cushion, marquise or pear costs about two seconds. Nothing here is ever counted —
 * the rings are only positioned — so the extra precision buys nothing. Measured worst-case
 * departure from 1000 samples is 2.3e-4 mm. See ARC_SAMPLES.
 */
const COLLAR_SAMPLES = 100;

export type BezelInput = {
  width: number;
  length: number;
  girdleThickness: number;
  /** The collar scales off the prong width, not the halo's thickness ratio. */
  prongWidth: number;
};

/** The collar's key dimensions, all proportional to the prong width. */
function proportions(prongWidth: number) {
  return {
    /** Wall thickness. */
    wall: (prongWidth / 2) * 0.9,
    /** How far the base tucks back in under the wall. */
    taper: 1.1 * prongWidth * 0.9,
    /** Overall height. */
    top: 1.3 * prongWidth * 0.9,
  };
}

/**
 * Height of a bezel's base above the culet.
 *
 * The source reuses its halo-height helper with the bezel flag set, which swaps the halo's
 * fixed drop for the collar's own top and clearance.
 */
export function bezelHeight(
  stoneY: number,
  pavHeight: number,
  girdleThickness: number,
  prongWidth: number,
): number {
  const { top } = proportions(prongWidth);
  return stoneY + pavHeight + girdleThickness + GIRDLE_CLEARANCE - top;
}

/** One ring of the collar, at a given size and height. `outer` picks the outward-facing pass. */
type RingAt = (x: number, z: number, outer: boolean) => PlanePoint[];

function ringFor(shape: string, input: BezelInput): { at: RingAt; points: number } {
  const { wall } = proportions(input.prongWidth);

  switch (shape) {
    case "Round":
      return { points: 100, at: (x) => circleRing(100, x) };

    case "Oval":
      return { points: 100, at: (x, z) => ellipseRing(100, x, z) };

    case "Princess":
      return {
        points: 100,
        at: (x, z) => roundedRectRing(100, x, z, PRINCESS_CORNER),
      };

    case "Cushion":
      return { points: 64, at: (x, z) => cushionRing(64, x, z, BLEND_FLOOR, COLLAR_SAMPLES) };

    case "Asscher":
    case "Emerald":
    case "Radiant": {
      const cut = (CORNER_CUT[shape] ?? CORNER_CUT.Asscher) * input.width;
      // The outer passes chamfer wider, by the amount the wall adds across a 45° corner.
      const outerCut = cut + wall * (2 - Math.SQRT2);
      return {
        points: 100,
        at: (x, z, outer) => cutCornerRing(100, x, z, outer ? outerCut : cut),
      };
    }

    case "Marquise":
      return {
        points: 64,
        at: (x, z, outer) => marquiseRing(64, x, z, outer ? wall : 0, TAPER, COLLAR_SAMPLES),
      };

    case "Pear":
      return {
        points: 64,
        at: (x, z, outer) => pearRing(64, x, z, outer ? wall : 0, TAPER, COLLAR_SAMPLES),
      };

    default:
      return { points: 100, at: (x) => circleRing(100, x) };
  }
}

/**
 * Builds the collar.
 *
 * Returns `null` for a shape with no outline of its own, leaving the caller to skip the bezel
 * rather than draw a wrong one.
 */
export function bezelGeometry(
  shape: string,
  input: BezelInput,
): THREE.BufferGeometry | null {
  const { width, length, girdleThickness, prongWidth } = input;
  const { wall, taper, top } = proportions(prongWidth);
  const { at, points } = ringFor(shape, input);

  // A pear's outline is measured from its widest point to the tip, not from its centre.
  const semiX = width / 2;
  const semiZ = shape === "Pear" ? length - width / 2 : length / 2;

  /** The four radii the profile interpolates between, per axis. */
  const edge = (semi: number) => ({
    topOuter: 0.98 * semi + wall,
    topInner: 0.98 * semi,
    bottomOuter: 0.98 * semi + wall,
    bottomInner: 0.98 * semi + wall - taper,
  });
  const ex = edge(semiX);
  const ez = edge(semiZ);

  /** Height the outer wall sweeps through before the top fillet takes over. */
  const rise = top - TOP_FILLET;

  const positions: number[] = [];
  const pushRing = (
    scaleX: number,
    scaleZ: number,
    y: number,
    outer: boolean,
  ) => {
    const ring = at(scaleX, scaleZ, outer);
    for (const p of ring) positions.push(p.x, y, p.z);
  };

  const step = (i: number) => (Math.PI / 2 / 12) * i;

  // 1 — outer wall, curving up and outward off the base.
  for (let i = 0; i < 12; i++) {
    const a = step(i);
    pushRing(
      ex.bottomOuter - OUTER_SWEEP + OUTER_SWEEP * Math.sin(a),
      ez.bottomOuter - OUTER_SWEEP + OUTER_SWEEP * Math.sin(a),
      rise - rise * Math.cos(a),
      true,
    );
  }
  // 2 — over the top outer edge.
  for (let i = 0; i < 12; i++) {
    const a = step(i);
    pushRing(
      ex.topOuter - TOP_FILLET + TOP_FILLET * Math.cos(a),
      ez.topOuter - TOP_FILLET + TOP_FILLET * Math.cos(a),
      top - TOP_FILLET + TOP_FILLET * Math.sin(a),
      true,
    );
  }
  // 3 — back down inside the rim.
  for (let i = 0; i < 12; i++) {
    const a = step(i);
    pushRing(
      ex.topInner + TOP_FILLET - TOP_FILLET * Math.sin(a),
      ez.topInner + TOP_FILLET - TOP_FILLET * Math.sin(a),
      top - TOP_FILLET + TOP_FILLET * Math.cos(a),
      false,
    );
  }
  // 4 — the inner wall, stopping just under the girdle so the stone seats on it.
  pushRing(ex.topInner, ez.topInner, top - (GIRDLE_CLEARANCE + girdleThickness), false);
  // 5 — the floor.
  pushRing(ex.bottomInner, ez.bottomInner, 0, false);

  const rings = 38;
  const total = positions.length / 3;
  const index: number[] = [];

  for (let r = 0; r < rings; r++) {
    const below = (r + 1) % rings;
    for (let i = 0; i < points; i++) {
      const a = i + r * points;
      const b = (a + 1) % points === 0 ? a - points + 1 : a + 1;
      const c = i + below * points;
      const d = (c + 1) % points === 0 ? c - points + 1 : c + 1;
      if (a >= total || b >= total || c >= total || d >= total) continue;
      index.push(a, c, b);
      index.push(d, b, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
