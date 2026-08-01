/**
 * The band — a closed profile swept around the finger.
 *
 * Ported from the configurator's own band component. Two controls shape it, and they act on
 * opposite faces:
 *
 *   **Style** shapes the *outside*, the part you see. `Round` domes it over; `Square` runs it
 *   flat with a small rounded edge either side.
 *
 *   **Fit** shapes the *inside*, the part against the finger. `Comfort Fit` rounds it so the
 *   ring slides on easily; `Standard Fit` squares it off for a more secure seat. That is the
 *   site's own description of the setting, and the geometry matches it exactly.
 *
 * The thing this replaces — a plain torus — could express neither, and got a third thing wrong
 * besides: it tied the band's *radial thickness* to the width slider, so widening the band also
 * made it deeper. The vendor holds thickness at a constant 1.8mm and lets the slider move only
 * the width across the finger.
 *
 * Not reproduced: the configurator cuts pavé seats and merges the cathedral shoulders into this
 * shape with CSG booleans. Those need the `Pave Style` and `Cathedral` options, which this build
 * does not yet render.
 */
import * as THREE from "three";

export const BAND_STYLES = ["Round", "Square"] as const;
export const BAND_FITS = ["Comfort Fit", "Standard Fit"] as const;

export type BandStyle = (typeof BAND_STYLES)[number];
export type BandFit = (typeof BAND_FITS)[number];

/** Radial thickness of the band, in mm. Fixed — the width slider does not touch it. */
export const BAND_THICKNESS = 1.8;

/** How deep the inner face is cut back from the nominal size, in mm. */
const INNER_DEPTH = 0.2 * BAND_THICKNESS;

/** Height of the outer profile above the inner face. */
const OUTER_HEIGHT = BAND_THICKNESS - INNER_DEPTH;

/** Radius of the rounded edge on the squared profiles. */
const EDGE = 0.2;

/** How far the squared outer profile stops short of full height. */
const SHOULDER = 0.05;

/** Segments in each quarter-turn of a rounded profile. */
const ARC = 24;

/**
 * US ring size → the band's inner radius in millimetres.
 *
 * The vendor rounds the *diameter* to a tenth of a millimetre before halving it, so sizes land
 * on real manufacturing steps rather than on a continuous line.
 */
export function bandInnerRadius(ringSize: number): number {
  return Math.round(10 * (0.8095 * ringSize + 11.6645)) / 10 / 2;
}

/** Outer radius — where the head is seated. */
export function bandOuterRadius(ringSize: number): number {
  return bandInnerRadius(ringSize) + BAND_THICKNESS;
}

/** A point on the cross-section: how far out from the inner face, and where across the width. */
export type ProfilePoint = { radial: number; axial: number };

/** The outer face, walked from the `+width/2` edge round to `−width/2`. */
function outerProfile(style: BandStyle, width: number): ProfilePoint[] {
  const half = width / 2;
  const points: ProfilePoint[] = [];

  if (style === "Square") {
    const rise = OUTER_HEIGHT - SHOULDER - EDGE;
    points.push({ radial: 0, axial: half });
    for (let i = 0; i < 6; i++) {
      points.push({ radial: (i / 6) * rise, axial: half });
    }
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 2 / 12) * i;
      points.push({
        radial: rise + EDGE * Math.sin(a),
        axial: half - EDGE + EDGE * Math.cos(a),
      });
    }
    for (let i = 0; i < 6; i++) {
      points.push({
        radial: OUTER_HEIGHT - SHOULDER,
        axial: half - EDGE - (i / 6) * (width - 2 * EDGE),
      });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 2 + (Math.PI / 2 / 12) * i;
      points.push({
        radial: rise + EDGE * Math.sin(a),
        axial: -half + EDGE + EDGE * Math.cos(a),
      });
    }
    for (let i = 0; i <= 6; i++) {
      points.push({ radial: ((6 - i) / 6) * rise, axial: -half });
    }
    return points;
  }

  // Round: a half-dome, flat where it meets the edges.
  for (let i = 0; i <= ARC; i++) {
    const a = (Math.PI / ARC) * i;
    points.push({
      radial: OUTER_HEIGHT * Math.sin(a),
      axial: half * Math.cos(a),
    });
  }
  return points;
}

/** The inner face, walked the same way — `+width/2` round to `−width/2`. */
function innerProfile(fit: BandFit, width: number): ProfilePoint[] {
  const half = width / 2;
  const points: ProfilePoint[] = [];

  if (fit === "Standard Fit") {
    const drop = INNER_DEPTH - EDGE;
    for (let i = 0; i < 6; i++) {
      points.push({ radial: -((i / 6) * drop), axial: half });
    }
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 2 / 12) * i;
      points.push({
        radial: -(drop + EDGE * Math.sin(a)),
        axial: half - EDGE + EDGE * Math.cos(a),
      });
    }
    for (let i = 0; i < 6; i++) {
      points.push({
        radial: -INNER_DEPTH,
        axial: half - EDGE - (i / 6) * (width - 2 * EDGE),
      });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 2 + (Math.PI / 2 / 12) * i;
      points.push({
        radial: -(drop + EDGE * Math.sin(a)),
        axial: -half + EDGE + EDGE * Math.cos(a),
      });
    }
    for (let i = 0; i <= 6; i++) {
      points.push({ radial: -drop + (i / 6) * drop, axial: -half });
    }
    return points;
  }

  // Comfort: rounded, bulging back into the band so the finger meets a curve.
  for (let i = 0; i <= ARC; i++) {
    const a = (Math.PI / ARC) * i;
    points.push({
      radial: -(INNER_DEPTH * Math.sin(a)),
      axial: half * Math.cos(a),
    });
  }
  return points;
}

/**
 * The full closed cross-section: out over the face, back along the inside.
 *
 * Both halves are generated running the same way, so the inner one is reversed to close the
 * loop, and the shared end points are dropped so the seam has no zero-area quads.
 */
export function bandProfile(
  style: BandStyle,
  fit: BandFit,
  width: number,
): ProfilePoint[] {
  const outer = outerProfile(style, width);
  const inner = innerProfile(fit, width).reverse();
  return [...outer, ...inner.slice(1, -1)];
}

/**
 * Sweeps the profile into a band.
 *
 * Built in the xy plane with the width running along z and the ring's centre at the origin, so
 * the caller drops it by `bandOuterRadius` to bring the seat to y = 0.
 */
export function bandGeometry(
  style: BandStyle,
  fit: BandFit,
  width: number,
  ringSize: number,
  segments = 256,
): THREE.BufferGeometry {
  const profile = bandProfile(style, fit, width);
  // The profile's radial zero sits one inner-depth out, so the comfort dome bottoms out on the
  // nominal size rather than cutting inside it.
  const base = bandInnerRadius(ringSize) + INNER_DEPTH;

  const positions: number[] = [];
  for (const p of profile) {
    const r = base + p.radial;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * 2 * Math.PI;
      positions.push(r * Math.cos(a), r * Math.sin(a), p.axial);
    }
  }

  const index: number[] = [];
  for (let row = 0; row < profile.length; row++) {
    const next = (row + 1) % profile.length;
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const a = row * segments + i;
      const b = row * segments + j;
      const c = next * segments + i;
      const d = next * segments + j;
      index.push(a, c, b);
      index.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
