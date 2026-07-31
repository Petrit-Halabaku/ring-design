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
 * Radius of the stone's outline at an azimuth, with `atZero` along θ=0 — matching the
 * convention `prongASides` uses, so a basket stays concentric with the prong seats.
 */
export function outlineRadius(
  theta: number,
  atZero: number,
  atQuarter: number,
): number {
  const c = atQuarter * Math.cos(theta);
  const s = atZero * Math.sin(theta);
  return (atZero * atQuarter) / Math.sqrt(c * c + s * s);
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

export type RimSegment = {
  azimuth: number;
  kind: "block" | "plain";
  /** Blocks come in two rim thicknesses; the spacing picks one. */
  thickness: 0.15 | 0.23;
  /** Plain pieces are handed — each span is capped Right at its start, Left at its end. */
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
export function rimSegments(
  azimuths: number[],
  radius: number,
  scale = 1,
  capped = true,
): RimSegment[] {
  if (azimuths.length === 0 || radius <= 0) return [];

  const sorted = [...azimuths].sort((a, b) => a - b);
  const blockPitch = (t: 0.15 | 0.23) =>
    (t === 0.15 ? RIM_PITCH.block015 : RIM_PITCH.block023) * scale;
  const plainPitch = RIM_PITCH.plain * scale;

  const out: RimSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i];
    const to = i === sorted.length - 1 ? sorted[0] + Math.PI * 2 : sorted[i + 1];

    // Work in arc length, the way the configurator walks its outline rather than in angle.
    const span = (to - from) * radius;

    // Spacing decides which of the two block thicknesses the run uses.
    const rough = Math.max(1, Math.round(span / blockPitch(0.23)));
    const thickness: 0.15 | 0.23 =
      span / rough < RIM_THIN_THRESHOLD * scale ? 0.15 : 0.23;

    // Two plain pieces cap the run; blocks fill what's left between them.
    const caps = capped ? 2 * plainPitch : 0;
    const blocks = Math.max(
      1,
      Math.round((span - caps) / blockPitch(thickness)),
    );

    // Distribute the whole span exactly across every piece so consecutive ones touch.
    const pieces = blocks + (capped ? 2 : 0);
    const step = (to - from) / pieces;

    for (let n = 0; n < pieces; n++) {
      const azimuth = from + step * (n + 0.5);
      const isFirst = capped && n === 0;
      const isLast = capped && n === pieces - 1;
      out.push({
        azimuth,
        kind: isFirst || isLast ? "plain" : "block",
        thickness,
        side: isFirst ? "Right" : "Left",
      });
    }
  }

  return out;
}
