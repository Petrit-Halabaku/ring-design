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
  stoneWidth,
  innerRadius,
}: {
  outerRadius: number;
  seatHeight: number;
  stoneWidth: number;
  innerRadius: number;
}): CathedralShoulders {
  // The head's seat, plain. There used to be half a rim subtracted here to sink the anchor into
  // the cage, back when the arm arrived inner-face-first and would otherwise have stopped short.
  // The outer face lands on the anchor now and the arm hangs below it, so that sink is paid
  // twice over and drops the tip out from under the head.
  const height = outerRadius + seatHeight;
  const lateral = 0.8 * 0.9 * (stoneWidth / 2);

  const base = innerRadius + INNER_DEPTH;
  const bearing = Math.atan(lateral / height);
  // Lead proportional to how far it has to climb — a radian per unit of relative climb. The
  // coefficient was 1.6 while `height` still had half a rim subtracted from it; with the anchor
  // moved to the head's seat that spread the shoulder over 50 degrees, and the band started
  // flaring so far down that it read as a bulge rather than a rise. Fitted against the source's
  // measured profile, which stays within 0.1mm of the plain band until 35 degrees off the head
  // and does all its climbing inside that.
  const lead = (height - base) / base;

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

export function cathedralPath(
  sweep: number,
  radius: number,
  base: number,
  shoulders: CathedralShoulders | null,
  /**
   * The section's full radial extent, so the shoulder's *outer* face is what lands on the anchor.
   *
   * The arm then hangs below its anchor and its highest point is its tip, which is how the
   * source's part is shaped and what buries the cut end in the head rather than leaving it in the
   * air above. Zero for a lone point, such as a pavé seat that is already the face.
   */
  depth = 0,
): { up: number; side: number } {
  // Fold the angle onto one shoulder; the other is its mirror.
  const signed = ((sweep + Math.PI) % (2 * Math.PI)) - Math.PI;
  const mirror = signed < 0 ? -1 : 1;
  const offset = Math.abs(signed);

  if (!shoulders || offset >= shoulders.angle) {
    return { up: radius * Math.cos(sweep), side: radius * Math.sin(sweep) };
  }

  // Smoothstepped, not linear. A linear blend has a non-zero slope where it meets the circle, so
  // the shoulder would kink away from the band and leave a crease along the join; easing it to
  // zero slope at both ends makes it leave tangentially and arrive at the anchor without a corner.
  const t = 1 - offset / shoulders.angle;
  const blend = t * t * (3 - 2 * t);

  // Interpolated in polar, not as two position vectors.
  //
  // Lerping the *points* walks the chord between them, and a chord cuts inside the circle it
  // spans: at a 29 degree separation that is nearly 1.5% of the radius, which showed as the band
  // visibly pinching in just before it flares. Carrying a radius and a bearing separately keeps
  // every intermediate point on its own arc, so the shoulder can only ever rise.
  const reach = Math.sqrt(
    Math.pow(shoulders.lateral, 2) + Math.pow(shoulders.height, 2),
  );
  const bearing = Math.atan2(shoulders.lateral, shoulders.height);

  const arrival = reach - (depth - (radius - base));
  const r = radius + (arrival - radius) * blend;
  const a = offset + (bearing - offset) * blend;

  return { up: r * Math.cos(a), side: mirror * r * Math.sin(a) };
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
 * The ring that closes the circle under the head.
 *
 * With a cathedral the shank itself becomes the two shoulders and stops where they meet the
 * head, so the band no longer completes a circle on its own. The source carries a second, plain
 * ring for that: same inner face, a shade shallower and narrower, so it never shows past the
 * shank it sits inside. Measured off the source's own meshes — its shank runs 8.61 to 10.05 at
 * 1.70 wide and this ring runs 8.61 to 9.71 at 1.52, which is where the two ratios come from.
 */
const CLOSING_DEPTH = 1.1 / 1.44;
const CLOSING_WIDTH = 1.52 / 1.7;

export function cathedralGeometry(
  style: BandStyle,
  fit: BandFit,
  width: number,
  ringSize: number,
  thickness = BAND_THICKNESS,
  shelf = 0,
  /**
   * The pavé run's arcs, cut back here too.
   *
   * This ring is part of the shank, so where the shank is cut back to the seat for the pavé to
   * stand on, this has to come with it — left at full height it rides above the seat and eats
   * three quarters of the clearance the melee are set with. Its seat is scaled down alongside
   * its section so the two flats never land on each other and z-fight.
   */
  flats: { from: number; to: number }[] = [],
  segments = 256,
): THREE.BufferGeometry {
  return bandGeometry(
    style,
    fit,
    width * CLOSING_WIDTH,
    ringSize,
    shelf * CLOSING_DEPTH,
    INNER_DEPTH + (thickness - INNER_DEPTH) * CLOSING_DEPTH,
    flats,
    segments,
  );
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
  /**
   * A cathedral's shoulders, if it has any.
   *
   * The band *is* the cathedral — it rises into the two shoulders and stops where they meet the
   * head, rather than staying a circle with an arch laid over it. An arch on top has to emerge
   * through the band's own surface somewhere, and the two surfaces hover within microns of each
   * other for the whole length of that emergence, which shows as a hard step partway up the
   * shoulder. One surface cannot step against itself.
   */
  shoulders: CathedralShoulders | null = null,
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
    // Depth of whatever section is in use — a flattened run is only as deep as the seat.
    let depth = 0;
    for (const p of section) depth = Math.max(depth, p.radial);
    for (const p of section) {
      // With no shoulders this is the plain circle, so both cases share one sweep.
      const { up, side } = cathedralPath(
        sweep,
        base + p.radial,
        base,
        shoulders,
        depth,
      );
      positions.push(side, up, p.axial);
    }
  }

  const index: number[] = [];
  // A cathedral stops where its shoulders meet the head; a plain band closes on itself. Wrapping
  // the last step onto the first across the head would bridge the two arms with a flat slab.
  const closes = shoulders ? segments - 1 : segments;
  for (let i = 0; i < closes; i++) {
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

  if (shoulders) {
    // Cap each arm where it meets the head, against the setting that covers it.
    const cap = (step: number, outward: boolean) => {
      const first = step * ring;
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < ring; k++) {
        cx += positions[(first + k) * 3];
        cy += positions[(first + k) * 3 + 1];
        cz += positions[(first + k) * 3 + 2];
      }
      const hub = positions.length / 3;
      positions.push(cx / ring, cy / ring, cz / ring);
      for (let k = 0; k < ring; k++) {
        const j = (k + 1) % ring;
        if (outward) index.push(hub, first + k, first + j);
        else index.push(hub, first + j, first + k);
      }
    };
    cap(0, false);
    cap(segments - 1, true);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
