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
 * Trapezoidal integral of the ellipse's speed from `from` to `to`.
 *
 * The source fixes 1000 samples regardless of how short the span is. That is wasteful on the
 * tiny spans the hunt below probes, but the sample count changes the answer, so it stays — the
 * loop is inlined instead, which costs nothing in accuracy.
 */
export function arcLength(from: number, to: number, a: number, b: number): number {
  const samples = 1000;
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
): number {
  let theta = start;
  let length = 0;
  for (const step of refinements) {
    if (step > 0) {
      while (length < target) {
        theta += step;
        length = arcLength(start, theta, a, b);
      }
    } else {
      while (length > target) {
        theta += step;
        length = arcLength(start, theta, a, b);
      }
    }
  }
  return theta;
}

/** The oval's ladder: coarse forward, back off, creep forward. */
const OVAL_REFINEMENTS = [0.05, -0.001, 1e-4] as const;

/** Everywhere else: the same, plus one more backward creep. */
const BLENDED_REFINEMENTS = [0.05, -0.001, 1e-4, -1e-5] as const;

export const advanceOval = (s: number, t: number, a: number, b: number) =>
  advance(s, t, a, b, OVAL_REFINEMENTS);

export const advanceBlended = (s: number, t: number, a: number, b: number) =>
  advance(s, t, a, b, BLENDED_REFINEMENTS);

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
  advanceFn = advanceBlended,
): number[] {
  const thetas = [0];
  for (let i = 0; i < count - 1; i++) {
    thetas.push(advanceFn(thetas[thetas.length - 1], step, a, b));
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
