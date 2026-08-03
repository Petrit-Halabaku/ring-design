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
 * Pavé reshapes this profile rather than being cut into it — see `shelf` below and `bandPave`.
 *
 * Cathedral is added rather than swept in: the band stays a true circle and the shoulders are
 * their own solid. See `cathedralGeometry`.
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

/**
 * Outer radius — where the head is seated.
 *
 * `thickness` is normally the fixed 1.8mm, but a pavé run deepens the band once the melee grow
 * past the plain dome, so the seat rises with it. See `bandPaveThickness`.
 */
export function bandOuterRadius(
  ringSize: number,
  thickness = BAND_THICKNESS,
): number {
  return bandInnerRadius(ringSize) + thickness;
}

/**
 * A cathedral's rise, in the band's own frame.
 *
 * Rather than sitting on the band, the shoulders *are* the band: over the last stretch before
 * the head the sweep blends off its circle and onto the head's anchor. The section does not
 * narrow on the way — the shoulder arrives at the head at the band's full width and thickness,
 * so the head it carries is never pinched down to fit a tapering strut. Both shoulders share
 * one description; the second is the first mirrored.
 */
export type CathedralShoulders = {
  /** Radial distance from the ring's centre out to the anchor at the head. */
  height: number;
  /** How far to the side of the ring's plane the anchor sits. */
  lateral: number;
  /** Where the shoulder leaves the circle, measured from the top. */
  angle: number;
};

/**
 * Where a cathedral's shoulders have to arrive, and how steeply they climb.
 *
 * The anchor is the head's own seat: `basketHeight` less half the rim, out to the side by a
 * fraction of the stone. The angle it leaves the circle at is then the bearing to that anchor
 * plus a lead proportional to how far it has to climb — capped at 65°, so a tall head makes a
 * steeper arch rather than one that starts halfway round the finger.
 */
export function cathedralShoulders({
  outerRadius,
  seatHeight,
  rimHeight,
  stoneWidth,
  innerRadius,
}: {
  outerRadius: number;
  seatHeight: number;
  rimHeight: number;
  stoneWidth: number;
  innerRadius: number;
}): CathedralShoulders {
  const height = outerRadius + seatHeight - rimHeight / 2;
  const lateral = 0.8 * 0.9 * (stoneWidth / 2);

  const base = innerRadius + INNER_DEPTH;
  const bearing = Math.atan(lateral / height);
  const lead = (1.6 * (height - base)) / base;

  return {
    height,
    lateral,
    angle: Math.min(bearing + lead, (65 * Math.PI) / 180),
  };
}

/**
 * Where a point at sweep angle `sweep` and radius `radius` lands once the shoulders rise.
 *
 * Shared by the band's own sweep and by anything set into it, so a pavé run follows the arch
 * instead of staying on the circle the band has left behind. `sweep` is measured from the head:
 * zero at the top, growing either way round.
 */
export function cathedralBlend(
  sweep: number,
  shoulders: CathedralShoulders | null,
): number {
  if (!shoulders) return 0;
  const offset = Math.abs(((sweep + Math.PI) % (2 * Math.PI)) - Math.PI);
  if (offset >= shoulders.angle) return 0;
  const t = 1 - offset / shoulders.angle;
  return t * t * (3 - 2 * t);
}

/**
 * The arch is held a hair under the band's own section.
 *
 * The arch is a *closed* ring, not two stubs: away from the shoulders it simply follows the
 * circle, tucked just inside the band where nothing can see it. That is what removes the join —
 * a solid that stops has to stop somewhere, and wherever it stopped its end showed as a line
 * across the shank. This one never stops, so the only place it meets air is where the blend
 * lifts it clear, and the smoothstep makes that emergence tangent.
 */
export const CATHEDRAL_INSET = 0.997;

export function cathedralPath(
  sweep: number,
  radius: number,
  base: number,
  shoulders: CathedralShoulders | null,
): { up: number; side: number } {
  const circle = {
    up: radius * Math.cos(sweep),
    side: radius * Math.sin(sweep),
  };
  if (!shoulders) return circle;

  // Fold the angle onto one shoulder; the other is its mirror.
  let offset = ((sweep + Math.PI) % (2 * Math.PI)) - Math.PI;
  const mirror = offset < 0 ? -1 : 1;
  offset = Math.abs(offset);
  if (offset >= shoulders.angle) return circle;

  // Smoothstepped, not linear. A linear blend has a non-zero slope where it meets the circle,
  // so the arch would kink away from the band and leave a crease along the join; easing it to
  // zero slope at both ends makes the shoulder leave the band tangentially and arrive at the
  // anchor without a corner.
  const t = 1 - offset / shoulders.angle;
  const blend = t * t * (3 - 2 * t);
  const toAnchorUp = shoulders.height - Math.cos(shoulders.angle) * base;
  const toAnchorSide = shoulders.lateral - Math.sin(shoulders.angle) * base;

  return {
    up:
      blend * (toAnchorUp * blend + Math.cos(shoulders.angle) * radius) +
      (1 - blend) * circle.up,
    side:
      mirror *
        blend *
        (toAnchorSide * blend + Math.sin(shoulders.angle) * radius) +
      (1 - blend) * circle.side,
  };
}

/** A point on the cross-section: how far out from the inner face, and where across the width. */
export type ProfilePoint = { radial: number; axial: number };

/**
 * The outer face, walked from the `+width/2` edge round to `−width/2`.
 *
 * `shelf` cuts the dome back and restarts it that far out, which is what makes the flat seat a
 * pavé run sits in. Zero on a plain band.
 */
function outerProfile(
  style: BandStyle,
  width: number,
  shelf = 0,
  thickness = BAND_THICKNESS,
): ProfilePoint[] {
  const half = width / 2;
  const height = thickness - INNER_DEPTH - shelf;
  const points: ProfilePoint[] = [];

  if (style === "Square") {
    const rise = height - SHOULDER - EDGE;
    points.push({ radial: 0, axial: half });
    for (let i = 0; i < 6; i++) {
      points.push({ radial: shelf + (i / 6) * rise, axial: half });
    }
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 2 / 12) * i;
      points.push({
        radial: shelf + rise + EDGE * Math.sin(a),
        axial: half - EDGE + EDGE * Math.cos(a),
      });
    }
    for (let i = 0; i < 6; i++) {
      points.push({
        radial: shelf + height - SHOULDER,
        axial: half - EDGE - (i / 6) * (width - 2 * EDGE),
      });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 2 + (Math.PI / 2 / 12) * i;
      points.push({
        radial: shelf + rise + EDGE * Math.sin(a),
        axial: -half + EDGE + EDGE * Math.cos(a),
      });
    }
    for (let i = 0; i <= 6; i++) {
      points.push({ radial: shelf + ((6 - i) / 6) * rise, axial: -half });
    }
    return points;
  }

  // Round: a half-dome, flat where it meets the edges.
  for (let i = 0; i <= ARC; i++) {
    const a = (Math.PI / ARC) * i;
    points.push({
      radial: shelf + height * Math.sin(a),
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
  shelf = 0,
  thickness = BAND_THICKNESS,
): ProfilePoint[] {
  const outer = outerProfile(style, width, shelf, thickness);
  const inner = innerProfile(fit, width).reverse();
  return [...outer, ...inner.slice(1, -1)];
}

/**
 * The two cathedral shoulders, as a solid of their own.
 *
 * The band stays a true circle; these arches are added to it. Each is the same cross-section
 * swept from where the shoulder leaves the circle up to the head's anchor, pinching to `neck` as
 * it arrives — so at its foot it coincides exactly with the band and the join is seamless.
 *
 * This is a deliberate departure from the configurator, which deforms the band's own sweep
 * instead of adding to it. Keeping the ring circular was the call here.
 */
export function cathedralGeometry(
  style: BandStyle,
  fit: BandFit,
  width: number,
  ringSize: number,
  shoulders: CathedralShoulders,
  shelf = 0,
  thickness = BAND_THICKNESS,
  /**
   * Arcs where the outer face is flattened to the shelf — the same pavé run the shank is cut
   * back along. The arch *is* the band over the shoulders, so leaving its dome in here would
   * arch it straight over the stones it is meant to carry.
   */
  flats: { from: number; to: number }[] = [],
  segments = 256,
): THREE.BufferGeometry {
  const profile = bandProfile(style, fit, width, shelf, thickness);
  const seated = profile.map((p) => ({ ...p, radial: Math.min(p.radial, shelf) }));
  const base = bandInnerRadius(ringSize) + INNER_DEPTH;
  const ring = profile.length;

  const wrap = (a: number) => {
    const t = a % (2 * Math.PI);
    return t < 0 ? t + 2 * Math.PI : t;
  };
  const flattened = (sweep: number) => {
    const a = wrap(sweep);
    return flats.some(({ from, to }) => {
      const f = wrap(from), t = wrap(to);
      return f <= t ? a >= f && a <= t : a >= f || a <= t;
    });
  };

  const positions: number[] = [];
  for (let step = 0; step < segments; step++) {
    const sweep = (step / segments) * 2 * Math.PI;
    // Full section the whole way up. The shoulder used to narrow to a neck as it climbed, which
    // squeezed the head between the two arms and left a smaller stone than the setting was
    // solved for; carrying the band's own width and thickness to the anchor keeps the head at
    // the size the rest of the solve assumes.
    const section = flattened(sweep) ? seated : profile;
    for (const p of section) {
      const r = base + p.radial * CATHEDRAL_INSET;
      const { up, side } = cathedralPath(sweep, r, base, shoulders);
      positions.push(side, up, p.axial * CATHEDRAL_INSET);
    }
  }

  const index: number[] = [];
  for (let step = 0; step < segments; step++) {
    const next = (step + 1) % segments;
    for (let i = 0; i < ring; i++) {
      const j = (i + 1) % ring;
      const a = step * ring + i;
      const b = step * ring + j;
      const c = next * ring + i;
      const d = next * ring + j;
      // Wound opposite to the band's, because this loop is nested the other way round: here a
      // row is one sweep step and a column is one profile point, where the band has it the
      // other way about. Same winding on a transposed grid gives the opposite orientation, and
      // an inward-facing arch reads as a hollow shell you can see straight through.
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
  shelf = 0,
  thickness = BAND_THICKNESS,
  /**
   * Arcs where the outer face is flattened to the shelf, in sweep radians from the head.
   *
   * Along a pavé run the authored pieces are full-width band segments that complete the band's
   * thickness themselves, so the shank is cut back to the seat and they stand on it. Leave the
   * dome in and its crown arches over the stones, showing only slivers either side of the ridge;
   * remove the shank altogether and the ring is hollow there, because the pieces are just 1.13mm
   * deep against the band's 1.8mm. The source flattens rather than cuts, and so does this.
   */
  flats: { from: number; to: number }[] = [],
  segments = 256,
): THREE.BufferGeometry {
  const profile = bandProfile(style, fit, width, shelf, thickness);
  // Same points, outer face capped at the seat. Identical count, so the sweep still stitches.
  const seated = profile.map((p) => ({ ...p, radial: Math.min(p.radial, shelf) }));

  // The profile's radial zero sits one inner-depth out, so the comfort dome bottoms out on the
  // nominal size rather than cutting inside it.
  const base = bandInnerRadius(ringSize) + INNER_DEPTH;
  const ring = profile.length;

  const wrap = (a: number) => {
    const t = a % (2 * Math.PI);
    return t < 0 ? t + 2 * Math.PI : t;
  };
  const flattened = (i: number) => {
    const a = wrap((i / segments) * 2 * Math.PI);
    return flats.some(({ from, to }) => {
      const f = wrap(from), t = wrap(to);
      return f <= t ? a >= f && a <= t : a >= f || a <= t;
    });
  };

  const positions: number[] = [];
  for (let i = 0; i < segments; i++) {
    const sweep = (i / segments) * 2 * Math.PI;
    const section = flattened(i) ? seated : profile;
    for (const p of section) {
      const r = base + p.radial;
      positions.push(r * Math.sin(sweep), r * Math.cos(sweep), p.axial);
    }
  }

  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    for (let k = 0; k < ring; k++) {
      const j = (k + 1) % ring;
      const a = i * ring + k;
      const b = i * ring + j;
      const c = next * ring + k;
      const d = next * ring + j;
      // Rows are sweep steps and columns are profile points here — the same nesting the arch
      // uses, and the opposite of what this function used to do. Winding follows the nesting:
      // transpose the grid without flipping the winding and every face points inward, which
      // renders as a hollow shell you can see straight through.
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
