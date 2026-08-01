/**
 * Curve machinery shared by the halo layouts that follow a rounded outline.
 *
 * Two ideas carry all of it.
 *
 * **Arc-length spacing.** Melee have to sit shoulder to shoulder, which means equal spacing
 * along the *curve*, not equal steps in the parameter. On an ellipse those differ sharply — a
 * constant-θ step bunches the stones at the ends and strings them out along the flanks. So the
 * source integrates the ellipse's speed numerically and hunts for each next θ.
 *
 * **Outline blending.** A cushion is neither an ellipse nor a rectangle, and a marquise is
 * neither an ellipse nor a rhombus. The source builds both underlying curves, then blends them
 * point by point with a weight that varies around the outline. That blend is what gives a
 * cushion its soft corners and a marquise its points.
 */

/**
 * Speed of the ellipse `x = b·sin θ, z = −a·cos θ` at `θ`.
 *
 * Plain `sqrt` of the squares rather than `Math.hypot`. That is what the source computes, and
 * `hypot`'s overflow-safe scaling would both cost several times as much on a path that runs
 * tens of millions of times and round differently in the last place.
 */
function speed(theta: number, a: number, b: number): number {
  const x = a * Math.sin(theta);
  const z = b * Math.cos(theta);
  return Math.sqrt(x * x + z * z);
}

/**
 * Samples the trapezoidal integral below uses. The source fixes 1000 regardless of how short
 * the span is, which is wildly wasteful on the tiny spans the hunt probes.
 *
 * It stays the default anyway, because the halo's block counts pass through `floor()` and a
 * different integral could tip one by a whole stone.
 *
 * Callers that only ever *position* things — the bezel — pass a smaller count. The hunt's final
 * `-1e-5` rung quantises its answer, so most of the time a coarser integral lands in the same
 * bucket and returns an identical θ. Not always, though: swept across nine carats and the three
 * blended shapes, 100 samples moves a vertex by at most 2.3e-4 mm against 1000. That is
 * invisible on a 6mm stone and, with nothing downstream being counted, cannot change anything
 * structural.
 */
export const ARC_SAMPLES = 1000;

/**
 * Trapezoidal integral of the ellipse's speed from `from` to `to`. The loop is inlined, which
 * costs nothing in accuracy.
 */

export function arcLength(
  from: number,
  to: number,
  a: number,
  b: number,
  samples = ARC_SAMPLES,
): number {
  const step = (to - from) / samples;

  let total = (speed(from, a, b) + speed(to, a, b)) / 2;
  for (let i = 1; i < samples; i++) {
    const theta = from + i * step;
    const x = a * Math.sin(theta);
    const z = b * Math.cos(theta);
    total += Math.sqrt(x * x + z * z);
  }
  return total * step;
}

/**
 * Finds the θ that is `target` of arc length on from `start`.
 *
 * Solved by overshoot-and-refine rather than inversion: stride forward coarsely, back off
 * finely, and repeat with smaller steps. `refinements` is the ladder of step sizes, alternating
 * direction — the source uses a three-rung ladder for the oval and a four-rung one everywhere
 * else, and the extra rung shifts the answer slightly, so the two are kept distinct.
 */
function advance(
  start: number,
  target: number,
  a: number,
  b: number,
  refinements: readonly number[],
  samples: number,
): number {
  let theta = start;
  let length = 0;
  for (const step of refinements) {
    if (step > 0) {
      while (length < target) {
        theta += step;
        length = arcLength(start, theta, a, b, samples);
      }
    } else {
      while (length > target) {
        theta += step;
        length = arcLength(start, theta, a, b, samples);
      }
    }
  }
  return theta;
}

/** The oval's ladder: coarse forward, back off, creep forward. */
const OVAL_REFINEMENTS = [0.05, -0.001, 1e-4] as const;

/** Everywhere else: the same, plus one more backward creep. */
const BLENDED_REFINEMENTS = [0.05, -0.001, 1e-4, -1e-5] as const;

export const advanceOval = (
  s: number, t: number, a: number, b: number, samples = ARC_SAMPLES,
) => advance(s, t, a, b, OVAL_REFINEMENTS, samples);

export const advanceBlended = (
  s: number, t: number, a: number, b: number, samples = ARC_SAMPLES,
) => advance(s, t, a, b, BLENDED_REFINEMENTS, samples);

/** Ramanujan's first approximation to an ellipse's perimeter. */
export function ellipsePerimeter(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

export type OutlineNode = {
  theta: number;
  x: number;
  z: number;
  /** Facing of the outline's tangent at this node, radians about y. */
  rotY: number;
};

/**
 * `count` θ values spaced equally by arc length around the whole ellipse, starting at 0.
 *
 * `a` is the semi-axis along z, `b` the one along x.
 */
export function arcSpacedThetas(
  count: number,
  a: number,
  b: number,
  step = ellipsePerimeter(a, b) / count,
  samples = ARC_SAMPLES,
): number[] {
  const thetas = [0];
  for (let i = 0; i < count - 1; i++) {
    thetas.push(advanceBlended(thetas[thetas.length - 1], step, a, b, samples));
  }
  return thetas;
}

/** Turns θ values into positions on the ellipse, with the tangent facing at each. */
export function ellipseNodes(
  thetas: number[],
  a: number,
  b: number,
): OutlineNode[] {
  return thetas.map((theta) => {
    const tangent =
      Math.sin(theta) !== 0
        ? (b * Math.cos(theta)) / (a * Math.sin(theta))
        : Infinity;
    return {
      theta,
      x: b * Math.sin(theta),
      z: -a * Math.cos(theta),
      rotY: Math.atan(tangent),
    };
  });
}

/**
 * A pear's ellipse is not an ellipse: over the back half the z radius collapses to the x one,
 * which rounds that end into a circle while the other end stays long. Everything else about the
 * node is unchanged.
 */
export function pearEllipseNodes(
  thetas: number[],
  a: number,
  b: number,
): OutlineNode[] {
  return ellipseNodes(thetas, a, b).map((node) => {
    const round = node.theta > Math.PI / 2 && node.theta < (3 * Math.PI) / 2;
    return round ? { ...node, z: -b * Math.cos(node.theta) } : node;
  });
}

export type PlanePoint = { x: number; z: number };

/**
 * The rectangle a cushion blends toward: `count` points walked around its perimeter at a
 * constant step, starting one step past the `(b, -a)` corner and going anticlockwise.
 *
 * Transcribed from the source's own walk, which tracks how far it has travelled and carries the
 * remainder across each corner so the spacing never resets.
 */
export function rectanglePoints(
  count: number,
  a: number,
  b: number,
): PlanePoint[] {
  const points: PlanePoint[] = [];
  const step = (2 * (2 * b + 2 * a)) / count;
  const push = (x: number, z: number) => points.push({ x, z });

  let travelled = 0;
  let x = step;
  let z = -a;

  for (; x <= b; x += step) {
    push(x, z);
    travelled += step;
  }
  for (x = b, z = step - (b - travelled) - a; z <= a; z += step) {
    push(x, z);
    travelled += step;
  }
  for (z = a, x = b - (step - (2 * a + b - travelled)); x >= -b; x -= step) {
    push(x, z);
    travelled += step;
  }
  for (x = -b, z = a - (step - (2 * a + 3 * b - travelled)); z >= -a; z -= step) {
    push(x, z);
    travelled += step;
  }
  for (z = -a, x = step - (4 * a + 3 * b - travelled) - b; points.length < count; x += step) {
    push(x, z);
    travelled += step;
  }

  return points;
}

/**
 * The rhombus a marquise blends toward — vertices at `(±b, 0)` and `(0, ±a)`, walked in two
 * passes so the points come round in the same order as the ellipse's.
 *
 * `halfOnly` is the pear's variant: the half with `z > 0` collapses to the origin, which is the
 * source's way of saying "no point at this end". Callers detect that with `isCollapsed` and
 * fall back to the pure ellipse there, leaving the pear round at the back and pointed at the
 * front.
 */
export function rhombusPoints(
  count: number,
  a: number,
  b: number,
  halfOnly = false,
): PlanePoint[] {
  const points: PlanePoint[] = [];
  const push = (x: number, z: number) => points.push({ x, z });

  for (let i = 0; i < count / 2; i++) {
    const z = i * ((2 * a) / (count / 2)) - a;
    const x = b - (b / a) * Math.abs(z);
    if (halfOnly && z > 0) push(0, 0);
    else push(x, z);
  }
  for (let i = 0; i < count / 2; i++) {
    const z = a - i * ((2 * a) / (count / 2));
    const x = -b + (b / a) * Math.abs(z);
    if (halfOnly && z > 0) push(0, 0);
    else push(x, z);
  }

  return points;
}

export const isCollapsed = (p: PlanePoint) => p.x === 0 && p.z === 0;

/**
 * Blend weight toward the polygon at one node.
 *
 * `cushion` measures how far the polygon point sits inside the bounding box on *both* axes at
 * once and never drops below `floor`, which keeps a cushion square-ish all the way round.
 * `taper` keys off the x inset alone and caps out, which pulls a marquise or pear onto its
 * points while leaving the flanks elliptical.
 */
export function cushionWeight(
  point: PlanePoint,
  a: number,
  b: number,
  floor: number,
): number {
  const inset = b - Math.abs(point.x) + (a - Math.abs(point.z));
  return (inset / (b + a)) * (1 - floor) + floor;
}

export function taperWeight(point: PlanePoint, b: number, cap: number): number {
  return Math.min(cap * ((b - Math.abs(point.x)) / b), 1);
}

/** Mixes an ellipse node with its polygon counterpart at the given weight. */
export function blendPoint(
  node: OutlineNode,
  polygon: PlanePoint,
  weight: number,
): PlanePoint {
  const keep = 1 - weight;
  return {
    x: keep * node.x + weight * polygon.x,
    z: keep * node.z + weight * polygon.z,
  };
}

/**
 * Closed outlines, one per stone shape.
 *
 * Both the halo's bed and the bezel's collar are built by evaluating one of these at a series
 * of sizes and heights, so they live here rather than in either. Each returns exactly `count`
 * points, walked in a consistent direction so consecutive rings can be stitched together.
 */

/** Plain circle — the round bezel's ring. Uses the `cos, sin` order the source's does. */
export function circleRing(count: number, radius: number): PlanePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * 2 * Math.PI;
    return { x: radius * Math.cos(t), z: radius * Math.sin(t) };
  });
}

/** Plain ellipse, same walk as `circleRing`. */
export function ellipseRing(count: number, x: number, z: number): PlanePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * 2 * Math.PI;
    return { x: x * Math.cos(t), z: z * Math.sin(t) };
  });
}

/** A cushion: ellipse mixed with rectangle, the rectangle read one point behind. */
export function cushionRing(
  count: number,
  x: number,
  z: number,
  floor: number,
  samples = ARC_SAMPLES,
): PlanePoint[] {
  const nodes = ellipseNodes(arcSpacedThetas(count, z, x, undefined, samples), z, x);
  const rect = rectanglePoints(count, z, x);
  return nodes.map((node, i) => {
    const mate = rect[(i + count - 1) % count];
    return blendPoint(node, mate, cushionWeight(mate, z, x, floor));
  });
}

/** A marquise: ellipse pulled onto points by a rhombus. */
export function marquiseRing(
  count: number,
  x: number,
  z: number,
  overhang: number,
  taper: number,
  samples = ARC_SAMPLES,
): PlanePoint[] {
  const nodes = ellipseNodes(arcSpacedThetas(count, z, x, undefined, samples), z, x);
  const rhombus = rhombusPoints(count, z + overhang, x);
  return nodes.map((node, i) =>
    blendPoint(node, rhombus[i], taperWeight(rhombus[i], x, taper)),
  );
}

/** A pear: the marquise blend over half the outline, the bare ellipse over the other. */
export function pearRing(
  count: number,
  x: number,
  z: number,
  overhang: number,
  taper: number,
  samples = ARC_SAMPLES,
): PlanePoint[] {
  const nodes = pearEllipseNodes(arcSpacedThetas(count, z, x, undefined, samples), z, x);
  const rhombus = rhombusPoints(count, z + overhang, x, true);
  return nodes.map((node, i) =>
    isCollapsed(rhombus[i])
      ? { x: node.x, z: node.z }
      : blendPoint(node, rhombus[i], taperWeight(rhombus[i], x, taper)),
  );
}

/**
 * A princess: a rectangle with rounded corners.
 *
 * Walked as four straight runs of `count/4 − 12` points alternating with four twelve-point
 * corner arcs, which is how the source splits it.
 */
export function roundedRectRing(
  count: number,
  x: number,
  z: number,
  radius: number,
): PlanePoint[] {
  const points: PlanePoint[] = [];
  const straight = count / 4 - 12;
  const spanX = (2 * x - 2 * radius) / (straight - 1);
  const spanZ = (2 * z - 2 * radius) / (straight - 1);
  const arc = (i: number) => (Math.PI / 2 / 12) * i;

  for (let i = 0; i < straight; i++) points.push({ x: x - radius - spanX * i, z });
  for (let i = 0; i < 12; i++) {
    points.push({
      x: -x + radius - radius * Math.sin(arc(i)),
      z: z - radius + radius * Math.cos(arc(i)),
    });
  }
  for (let i = 0; i < straight; i++) points.push({ x: -x, z: z - radius - spanZ * i });
  for (let i = 0; i < 12; i++) {
    points.push({
      x: -x + radius - radius * Math.cos(arc(i)),
      z: -z + radius - radius * Math.sin(arc(i)),
    });
  }
  for (let i = 0; i < straight; i++) points.push({ x: -x + radius + spanX * i, z: -z });
  for (let i = 0; i < 12; i++) {
    points.push({
      x: x - radius + radius * Math.sin(arc(i)),
      z: -z + radius - radius * Math.cos(arc(i)),
    });
  }
  for (let i = 0; i < straight; i++) points.push({ x, z: -z + radius + spanZ * i });
  for (let i = 0; i < 12; i++) {
    points.push({
      x: x - radius + radius * Math.cos(arc(i)),
      z: z - radius + radius * Math.sin(arc(i)),
    });
  }
  return points;
}

/**
 * The closed outline of any stone, at the given semi-axes.
 *
 * One dispatcher for all nine, so the halo's rail, the bezel's collar and the basket's rim all
 * follow the same curve. `count` is the point budget; it must divide by four for the squared
 * outlines and by two for the blended ones, and 128 satisfies both.
 */
export function outlineRing(
  shape: string,
  semiX: number,
  semiZ: number,
  count = 128,
  samples = ARC_SAMPLES,
): PlanePoint[] {
  switch (shape) {
    case "Round":
      return circleRing(count, semiX);
    case "Princess":
      // The same fixed 0.1mm corner the collar rounds its own outline with.
      return roundedRectRing(count, semiX, semiZ, 0.1);
    case "Asscher":
    case "Emerald":
    case "Radiant": {
      const factor =
        shape === "Emerald" ? 0.2026 : shape === "Radiant" ? 0.15308 : 0.15018;
      return cutCornerRing(count, semiX, semiZ, factor * 2 * semiX);
    }
    case "Cushion":
      return cushionRing(count, semiX, semiZ, 0.3, samples);
    case "Marquise":
      return marquiseRing(count, semiX, semiZ, 0, 0.55, samples);
    case "Pear":
      return pearRing(count, semiX, semiZ, 0, 0.55, samples);
    default:
      return ellipseRing(count, semiX, semiZ);
  }
}

/**
 * Distance from the origin out to the outline, along the bearing an azimuth points in.
 *
 * The rim code works in polar terms — "how far out is the outline at this prong's angle" — but
 * a real outline is a polyline, and a pear's is not even centred on the origin. So the radius is
 * ray-cast rather than evaluated: shoot from the origin along `(−sin θ, −cos θ)`, which is the
 * direction a prong at that azimuth leans, and take the first crossing.
 */
export function radiusAtBearing(ring: PlanePoint[], theta: number): number {
  const dx = -Math.sin(theta);
  const dz = -Math.cos(theta);
  let best = Infinity;

  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const ex = q.x - p.x;
    const ez = q.z - p.z;

    const den = dz * ex - dx * ez;
    if (Math.abs(den) < 1e-12) continue;

    const u = (dx * p.z - dz * p.x) / den;
    if (u < 0 || u > 1) continue;

    const t =
      Math.abs(dx) > Math.abs(dz) ? (p.x + u * ex) / dx : (p.z + u * ez) / dz;
    if (t > 0 && t < best) best = t;
  }

  return Number.isFinite(best) ? best : 0;
}

/**
 * An Asscher, Emerald or Radiant: a rectangle whose four runs stop `cut` short of each corner.
 *
 * There are no corner points at all — the chamfer is the straight line the stitching draws
 * between the end of one run and the start of the next.
 */
export function cutCornerRing(
  count: number,
  x: number,
  z: number,
  cut: number,
): PlanePoint[] {
  const points: PlanePoint[] = [];
  const per = count / 4;
  const spanX = (2 * x - 2 * cut) / (per - 1);
  const spanZ = (2 * z - 2 * cut) / (per - 1);

  for (let i = 0; i < per; i++) points.push({ x: x - cut - spanX * i, z });
  for (let i = 0; i < per; i++) points.push({ x: -x, z: z - cut - spanZ * i });
  for (let i = 0; i < per; i++) points.push({ x: -x + cut + spanX * i, z: -z });
  for (let i = 0; i < per; i++) points.push({ x, z: -z + cut + spanZ * i });
  return points;
}
