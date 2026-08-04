/**
 * Marquise halo — an ellipse blended toward a rhombus, which pulls both ends to a point.
 *
 * Ported from the configurator's `"Marquise" == name` branch. The blend weight keys off how far
 * in the rhombus point sits on x, so it approaches its cap at the tips and vanishes along the
 * flanks: pointed ends, elliptical sides.
 *
 * A `MarquiseCorner` goes at each tip and `MarquiseEdge` between. The block count is not solved
 * from a formula — the source measures the blended curve's own polyline length and divides.
 */
import { blendedBed } from "./beds";
import {
  arcSpacedThetas,
  blendPoint,
  ellipseNodes,
  rhombusPoints,
  taperWeight,
  type PlanePoint,
} from "./outline";
import {
  HALO_STONE,
  rimThickness,
  type HaloInput,
  type HaloLayout,
  type HaloPlacement,
} from "./types";

const RING_POINTS = 64;
const SWEEP_COLUMNS = 100;
/** Most the blend ever leans toward the rhombus, reached at the tips. */
const TAPER = 0.55;
const OVERSAMPLE = 2;

/**
 * One blended ring. `overhang` extends the rhombus past the ellipse's own z semi-axis, which is
 * how the outer ring keeps its point sharp instead of blunting as it grows.
 */
function blendedRing(
  count: number,
  x: number,
  z: number,
  overhang: number,
): PlanePoint[] {
  const nodes = ellipseNodes(arcSpacedThetas(count, z, x), z, x);
  const rhombus = rhombusPoints(count, z + overhang, x);
  return nodes.map((node, i) =>
    blendPoint(node, rhombus[i], taperWeight(rhombus[i], x, TAPER)),
  );
}

/** Length of a closed polyline, counting its first span twice as the source does. */
function traversed(points: PlanePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dz = points[i].z - points[i - 1].z;
    const span = Math.sqrt(dx * dx + dz * dz);
    total += i === 1 ? 2 * span : span;
  }
  return total;
}

export function marquiseHalo({ width, length, ratio }: HaloInput): HaloLayout {
  const rim = rimThickness(ratio);
  const pitch = (HALO_STONE + 2 * 0.05) * ratio;

  const innerX = width / 2;
  const innerZ = length / 2;
  const midX = innerX + rim / 2;
  const midZ = innerZ + rim / 2;

  const beds: HaloLayout["beds"] = [
    {
      geometry: blendedBed(
        blendedRing(RING_POINTS, innerX, innerZ, 0),
        blendedRing(RING_POINTS, innerX + rim, innerZ + rim, rim),
        rim,
        SWEEP_COLUMNS,
      ),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    },
  ];

  // The rail's own length decides how many blocks fit — measured, not derived.
  const perimeter = traversed(blendedRing(RING_POINTS, midX, midZ, rim / 2));
  const blocks = Math.floor(perimeter / 2 / pitch);
  const nodeCount = blocks * 2 * OVERSAMPLE;

  const thetas = arcSpacedThetas(nodeCount, midZ, midX);
  const nodes = ellipseNodes(thetas, midZ, midX);
  const rhombus = rhombusPoints(nodeCount, midZ + rim / 2, midX);
  const seats = nodes.map((node, i) =>
    blendPoint(node, rhombus[i], taperWeight(rhombus[i], midX, TAPER)),
  );

  const placements: HaloPlacement[] = [];
  const half = nodeCount / 2;
  for (let i = 0; i < nodeCount; i++) {
    const part = i === 0 || i === half ? "corner" : i % 2 === 0 ? "edge" : null;
    if (!part) continue;

    // Faced along the chord through its neighbours; the leading tip has no "before", so it
    // takes the axis outright.
    let rotY =
      i === 0
        ? Math.PI / 2
        : Math.atan(
            (seats[i + 1].x - seats[i - 1].x) /
              (seats[i + 1].z - seats[i - 1].z),
          );
    if (i > half) rotY += Math.PI;

    placements.push({ part, position: [seats[i].x, 0, seats[i].z], rotY });
  }

  return { placements, beds, stoneCount: 2 * blocks };
}
