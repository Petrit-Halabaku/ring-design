import { outlineRing, radiusAtBearing } from "./haloLayout/outline";
/**
 * Basket and halo geometry, ported from the configurator's bundle.
 *
 * A basket is a rim of segments sitting under the stone: one `Block` piece at each prong,
 * with `Plain` pieces filling the arcs between them. The rim's size comes from the stone's
 * own dimensions through a per-shape proportion table, and its height from where the stone
 * sits in the head.
 *
 * A halo is the same idea one level up — a ring of `Edge` pieces (plus `Corner` pieces on
 * the shapes that have corners) around the girdle, each carrying a melee.
 */

/** Per-shape basket proportions. `topOuter`/`bottomOuter` are fractions of the stone. */
export const BASKET_PROPORTIONS: Record<
  string,
  {
    topOuter: number;
    bottomOuter: number;
    verticalPlacement: number;
    verticalPlacementFixedSubtraction: number;
  }
> = {
  Round: { topOuter: 0.85, bottomOuter: 0.75, verticalPlacement: 0.6, verticalPlacementFixedSubtraction: 0.1 },
  Oval: { topOuter: 0.825, bottomOuter: 0.775, verticalPlacement: 0.6, verticalPlacementFixedSubtraction: 0.1 },
  Princess: { topOuter: 0.8, bottomOuter: 0.65, verticalPlacement: 0.5, verticalPlacementFixedSubtraction: 0.1325 },
  Asscher: { topOuter: 0.75, bottomOuter: 0.57, verticalPlacement: 0.5, verticalPlacementFixedSubtraction: 0.1325 },
  Emerald: { topOuter: 0.8, bottomOuter: 0.62, verticalPlacement: 0.5, verticalPlacementFixedSubtraction: 0.1325 },
  Radiant: { topOuter: 0.75, bottomOuter: 0.57, verticalPlacement: 0.5, verticalPlacementFixedSubtraction: 0.1325 },
  Cushion: { topOuter: 0.81, bottomOuter: 0.7, verticalPlacement: 0.55, verticalPlacementFixedSubtraction: 0.12 },
  Marquise: { topOuter: 0.8, bottomOuter: 0.7, verticalPlacement: 0.5, verticalPlacementFixedSubtraction: 0.1 },
  Pear: { topOuter: 0.79, bottomOuter: 0.69, verticalPlacement: 0.5, verticalPlacementFixedSubtraction: 0.1 },
};

const proportions = (shape: string) =>
  BASKET_PROPORTIONS[shape] ?? BASKET_PROPORTIONS.Round;

export type BasketMeasurements = {
  height: number;
  topOuterWidth: number;
  topOuterLength: number;
  topInnerWidth: number;
  topInnerLength: number;
  bottomOuterWidth: number;
  bottomOuterLength: number;
  bottomInnerWidth: number;
  bottomInnerLength: number;
};

/**
 * The basket's eight measurements. Every one is derived from the stone's half-dimensions
 * scaled by the shape's `topOuter`/`bottomOuter` ratios, then walked inward by fractions of
 * the prong width. A hidden halo collapses the rim to its inner edge.
 */
export function basketMeasurements(
  shape: string,
  width: number,
  length: number,
  prongWidth: number,
  hidden = false,
): BasketMeasurements {
  const p = proportions(shape);
  const halfWidth = width / 2;
  // A pear measures from its point rather than its centre.
  const halfLength = shape === "Pear" ? length - width / 2 : length / 2;

  let topOuterWidth = p.topOuter * halfWidth;
  let topOuterLength = p.topOuter * halfLength;
  const topInnerWidth = topOuterWidth - 0.25 * prongWidth;
  const topInnerLength = topOuterLength - 0.25 * prongWidth;
  let bottomOuterWidth = Math.max(
    p.bottomOuter * halfWidth,
    topInnerWidth + 0.05 * prongWidth,
  );
  let bottomOuterLength = Math.max(
    p.bottomOuter * halfLength,
    topInnerLength + 0.05 * prongWidth,
  );

  if (hidden) {
    topOuterWidth = topInnerWidth + 0.05 * prongWidth;
    topOuterLength = topInnerLength + 0.05 * prongWidth;
    bottomOuterWidth = topOuterWidth;
    bottomOuterLength = topOuterLength;
  }

  return {
    height: 0.8419 * prongWidth,
    topOuterWidth,
    topOuterLength,
    topInnerWidth,
    topInnerLength,
    bottomOuterWidth,
    bottomOuterLength,
    bottomInnerWidth: bottomOuterWidth - 0.5 * prongWidth,
    bottomInnerLength: bottomOuterLength - 0.5 * prongWidth,
  };
}

/**
 * Height of the basket rim. It hangs below the stone by whichever is smaller: a fraction of
 * the pavilion, or the pavilion less a fixed margin — so a shallow stone can't push the rim
 * up through its own girdle.
 */
export function basketHeight(
  shape: string,
  stoneY: number,
  pavHeight: number,
  clearance: number,
): number {
  const p = proportions(shape);
  const drop = clearance + pavHeight;
  return (
    stoneY -
    clearance +
    Math.min(
      p.verticalPlacement * drop,
      drop - p.verticalPlacementFixedSubtraction,
    )
  );
}

/**
 * Height of a halo ring. It sits just under the girdle so the melee read as a collar around
 * the stone rather than a band floating below it.
 */
export function haloHeight(
  stoneY: number,
  pavHeight: number,
  girdleThickness: number,
  thicknessRatio = 1,
): number {
  return stoneY + pavHeight + girdleThickness - 1.1834 * thicknessRatio;
}

/**
 * A stone's outline, sampled in polar form.
 *
 * Built once from the real per-shape curve — the same one the halo's rail and the bezel's collar
 * follow — and then queried by azimuth. It replaces the superellipse this file used to assume:
 * that could not represent a pear at all, being both symmetric and centred on the origin when a
 * pear is neither, which left the basket rim a lens floating across an off-centre stone.
 */
export type Outline = {
  radiusAt(theta: number): number;
};

/** `atZero` is the semi-axis along z (the length), `atQuarter` the one along x. */
export function makeOutline(
  shape: string,
  atZero: number,
  atQuarter: number,
  /**
   * Integration samples for the shapes whose outline is arc-length solved.
   *
   * Deliberately far below the source's 1000. The rim layout below already solves its spacing
   * in angle rather than walking the source's polyline, so this path is an approximation by
   * construction and there is no exact behaviour to preserve — only a shape to follow. A
   * hundred samples puts every vertex within 2.3e-4 mm of the fully converged curve.
   */
  samples = 100,
): Outline {
  const ring = outlineRing(shape, atQuarter, atZero, 128, samples);
  const cache = new Map<number, number>();
  return {
    radiusAt(theta: number) {
      const key = Math.round(theta * 1e6);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const r = radiusAtBearing(ring, theta);
      cache.set(key, r);
      return r;
    },
  };
}

/** A piece's placement on the rim: where it sits and which way it faces. */
export type RimFrame = { x: number; z: number; rotY: number };

/**
 * Position and facing for a piece at an azimuth.
 *
 * A prong at azimuth θ points along (−sin θ, 0, −cos θ), so that's the direction the rim
 * runs out in. Facing is taken from the outline's own *normal*, found by differencing
 * neighbouring points — on anything but a circle the normal is not the radial direction, and
 * using the radius instead is what makes pieces sit skew on a squared stone.
 */
export function rimFrame(
  azimuth: number,
  outline: Outline,
  /**
   * Which of the part's own axes points radially outward. Basket pieces are authored +x
   * radial; halo pieces are +z, which is why the configurator places those with a plain
   * `rotation.y = θ` and the basket's with a quarter-turn.
   */
  radialAxis: "x" | "z" = "x",
): RimFrame {
  const point = (t: number) => {
    const r = outline.radiusAt(t);
    return { x: -Math.sin(t) * r, z: -Math.cos(t) * r };
  };

  const eps = 1e-3;
  const before = point(azimuth - eps);
  const after = point(azimuth + eps);
  const here = point(azimuth);

  // Normal = tangent turned a quarter, flipped to point away from the axis.
  let nx = after.z - before.z;
  let nz = -(after.x - before.x);
  if (nx * here.x + nz * here.z < 0) {
    nx = -nx;
    nz = -nz;
  }
  const length = Math.hypot(nx, nz) || 1;

  const facing = Math.atan2(-nz / length, nx / length);

  return {
    x: here.x,
    z: here.z,
    rotY: radialAxis === "z" ? facing - Math.PI / 2 : facing,
  };
}

/** Cumulative arc length of the outline, sampled densely enough to walk by distance. */
function outlineSamples(outline: Outline, count = 1440) {
  const angles: number[] = [];
  const arc: number[] = [];
  let total = 0;
  let prev = { x: 0, z: 0 };

  for (let i = 0; i <= count; i++) {
    const t = (i / count) * Math.PI * 2;
    const r = outline.radiusAt(t);
    const p = { x: -Math.sin(t) * r, z: -Math.cos(t) * r };
    if (i > 0) total += Math.hypot(p.x - prev.x, p.z - prev.z);
    angles.push(t);
    arc.push(total);
    prev = p;
  }
  return { angles, arc, total };
}

/** Azimuth at a given distance along the outline. */
function azimuthAtArc(
  samples: ReturnType<typeof outlineSamples>,
  distance: number,
): number {
  const { angles, arc, total } = samples;
  let d = distance % total;
  if (d < 0) d += total;

  let lo = 0;
  let hi = arc.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return angles[0];
  const span = arc[lo] - arc[lo - 1] || 1;
  const f = (d - arc[lo - 1]) / span;
  return angles[lo - 1] + f * (angles[lo] - angles[lo - 1]);
}

/**
 * Authored pitch of each rim piece, in millimetres — the spacing the configurator lays them
 * out on, not their bounding box. The pieces are modelled slightly wider than their pitch so
 * consecutive ones overlap into a seamless rim; spacing by bounding box (as an earlier
 * version here did) leaves a visible gap between every segment.
 */
export const RIM_PITCH = { block015: 0.9559, block023: 1.108, plain: 0.4871 };

/** Below this spacing the configurator switches to the thinner 0.15 block. */
export const RIM_THIN_THRESHOLD = 0.925;

/** Total length once round an outline. */
export function outlinePerimeter(outline: Outline): number {
  return outlineSamples(outline).total;
}

/**
 * `count` frames spaced evenly by arc length all the way round an outline — for a halo,
 * whose pieces ring the whole stone rather than sitting between prongs.
 */
export function ringFrames(
  count: number,
  outline: Outline,
  radialAxis: "x" | "z" = "x",
): RimFrame[] {
  const samples = outlineSamples(outline);
  return Array.from({ length: count }, (_, i) =>
    rimFrame(
      azimuthAtArc(samples, (samples.total * i) / count),
      outline,
      radialAxis,
    ),
  );
}

export type RimPiece = RimFrame & {
  kind: "block" | "plain";
  /** Blocks come in two rim thicknesses; the spacing picks one. */
  thickness: 0.15 | 0.23;
  /** Plain pieces are handed — mirror halves of each run. */
  side: "Left" | "Right";
};

/**
 * Lays out a rim: a `block` at each prong azimuth, and as many `plain` pieces as fit in the
 * arc between consecutive prongs, evenly spaced.
 *
 * The configurator walks a polyline of the outline and measures real arc length between
 * pieces. This works the same way but solves the spacing in angle, which is equivalent for
 * the near-circular rims a basket actually has and avoids carrying its polyline machinery.
 */
export function rimLayout(
  azimuths: number[],
  outline: Outline,
  scale = 1,
  /** A plain basket is all `Plain` pieces — they carry no stone seats, so the rail is smooth. */
  smooth = true,
): RimPiece[] {
  if (azimuths.length === 0) return [];

  const samples = outlineSamples(outline);
  const { angles, arc, total } = samples;

  /** Distance along the outline at an azimuth. */
  const arcAt = (theta: number) => {
    let t = theta % (Math.PI * 2);
    if (t < 0) t += Math.PI * 2;
    let lo = 0;
    let hi = angles.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (angles[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return arc[0];
    const span = angles[lo] - angles[lo - 1] || 1;
    const f = (t - angles[lo - 1]) / span;
    return arc[lo - 1] + f * (arc[lo] - arc[lo - 1]);
  };

  const plainPitch = RIM_PITCH.plain * scale;
  const sorted = [...azimuths].sort((a, b) => a - b);
  const out: RimPiece[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const startArc = arcAt(sorted[i]);
    const rawEnd = i === sorted.length - 1 ? arcAt(sorted[0]) + total : arcAt(sorted[i + 1]);
    const span = rawEnd - startArc;
    if (span <= 0) continue;

    // Blocks come in two thicknesses; the spacing picks one. A smooth rail uses neither.
    const rough = Math.max(1, Math.round(span / (RIM_PITCH.block023 * scale)));
    const thickness: 0.15 | 0.23 =
      span / rough < RIM_THIN_THRESHOLD * scale ? 0.15 : 0.23;

    const pitch = smooth
      ? plainPitch
      : (thickness === 0.15 ? RIM_PITCH.block015 : RIM_PITCH.block023) * scale;
    const count = Math.max(1, Math.round(span / pitch));

    for (let n = 0; n < count; n++) {
      // Equal steps in *arc length*, then converted back to an angle — on a squared outline
      // equal angles would bunch the pieces up at the corners.
      const azimuth = azimuthAtArc(samples, startArc + (span * (n + 0.5)) / count);
      out.push({
        ...rimFrame(azimuth, outline),
        kind: smooth ? "plain" : "block",
        thickness,
        // Handed pieces are mirrored halves, so each run turns over at its midpoint.
        side: n < count / 2 ? "Right" : "Left",
      });
    }
  }

  return out;
}
