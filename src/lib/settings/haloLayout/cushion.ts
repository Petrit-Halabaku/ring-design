/**
 * Cushion halo — an ellipse blended toward a rectangle.
 *
 * Ported from the configurator's `"Cushion" == name` branch. A cushion outline is neither
 * curve: the source builds both, then mixes them point by point with a weight that rises as the
 * rectangle point approaches a corner and never falls below `BLEND_FLOOR`. That floor is what
 * keeps the sides gently straight instead of bowing out into an ellipse.
 *
 * The blocks are laid out one side at a time. Each side re-solves its own arc step so the run
 * lands exactly on its end angle, then places a corner piece at each end of the run and edge
 * pieces between — at every second node, since the source oversamples by two.
 */
import { blendedBed } from "./beds";
import {
  advanceBlended,
  arcLength,
  arcSpacedThetas,
  blendPoint,
  cushionWeight,
  ellipseNodes,
  rectanglePoints,
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
/** Lowest the blend ever leans toward the rectangle — the cushion's squareness. */
const BLEND_FLOOR = 0.3;
const OVERSAMPLE = 2;

/** One blended ring: an ellipse of `RING_POINTS` mixed with the matching rectangle. */
function blendedRing(x: number, z: number): PlanePoint[] {
  const thetas = arcSpacedThetas(RING_POINTS, z, x);
  const nodes = ellipseNodes(thetas, z, x);
  const rect = rectanglePoints(RING_POINTS, z, x);

  return nodes.map((node, i) => {
    // The bed reads the rectangle one point behind the ellipse's. The block layout below does
    // not — this offset is the source's, and only applies here.
    const mate = rect[(i + RING_POINTS - 1) % RING_POINTS];
    return blendPoint(node, mate, cushionWeight(mate, z, x, BLEND_FLOOR));
  });
}

export function cushionHalo({
  width,
  length,
  carat,
  ratio,
}: HaloInput): HaloLayout {
  const rim = rimThickness(ratio);
  // Small stones take a tighter pitch, so the melee still read as a continuous rail on a rail
  // that short.
  const pitch =
    carat < 0.65
      ? (HALO_STONE - 0.04) * ratio
      : (HALO_STONE + 0.4 * 0.05) * ratio;

  const innerX = width / 2;
  const innerZ = length / 2;
  const midX = innerX + rim / 2;
  const midZ = innerZ + rim / 2;

  const beds: HaloLayout["beds"] = [
    {
      geometry: blendedBed(
        blendedRing(innerX, innerZ),
        blendedRing(innerX + rim, innerZ + rim),
        rim,
        SWEEP_COLUMNS,
      ),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    },
  ];

  /**
   * The angle at which the outline turns its corner.
   *
   * A square cushion just takes the diagonal. An oblong one derives it from the same corner
   * inset the prong solve uses (`0.211`), so the halo's corners land under the prongs.
   */
  let corner: number;
  let cornerPoint: PlanePoint;
  if (width === length) {
    corner = Math.atan(midX / midZ);
    cornerPoint = { x: midX * Math.sin(corner), z: -midZ * Math.cos(corner) };
  } else {
    const inset = 0.211 * width * 0.5;
    const radius = Math.sqrt((width / 2 - inset) ** 2 + (length / 2 - inset) ** 2);
    const bearing = Math.atan((width - 2 * inset) / (length - 2 * inset));
    const alongX = Math.asin((radius / midX) * Math.sin(bearing));
    const alongZ = Math.acos((radius / midZ) * Math.cos(bearing));
    cornerPoint = { x: midX * Math.sin(alongX), z: -midZ * Math.cos(alongZ) };
    corner = (alongX + alongZ) / 2;
  }

  // How much of each side the runs actually have to fill, measured at the blend.
  const reach = {
    x: BLEND_FLOOR * midX + (1 - BLEND_FLOOR) * cornerPoint.x,
    z: BLEND_FLOOR * -midZ + (1 - BLEND_FLOOR) * cornerPoint.z,
  };
  const spanZ = 2 * Math.abs(reach.z);
  const spanX = 2 * Math.abs(reach.x);
  const countZ = Math.floor(spanZ / pitch);
  const countX = Math.floor(spanX / pitch);
  const stepZ = spanZ / countZ / OVERSAMPLE;
  const stepX = spanX / countX / OVERSAMPLE;

  const placements: HaloPlacement[] = [];

  /**
   * Lays one side out between two angles.
   *
   * The first pass finds how far a run of `count` even steps actually reaches; the second
   * redistributes the shortfall so the last node lands on `to`. Only then are parts placed.
   */
  const side = (
    sideLength: number,
    facing: "South" | "West" | "North" | "East",
    count: number,
    step: number,
    from: number,
    to: number,
  ) => {
    const walk = (by: number) => {
      const thetas = [from];
      for (let i = 0; i < count - 1; i++) {
        thetas.push(advanceBlended(thetas[thetas.length - 1], by, midZ, midX));
      }
      return thetas;
    };

    const rough = walk(step);
    const spans = rough.length - 1;
    const corrected =
      (step * spans + arcLength(rough[rough.length - 1], to, midZ, midX)) /
      (spans + 1);
    const nodes = ellipseNodes(walk(corrected), midZ, midX);

    // The straight edge this side blends toward, walked from its own starting corner.
    const gap = sideLength / count;
    const straight: PlanePoint[] = [];
    let x = facing === "South" || facing === "East" ? midX : -midX;
    let z = facing === "South" || facing === "West" ? midZ : -midZ;
    straight.push({ x, z });
    for (let i = 0; i < count - 1; i++) {
      if (facing === "South") x -= gap;
      else if (facing === "West") z -= gap;
      else if (facing === "North") x += gap;
      else z += gap;
      straight.push({ x, z });
    }

    /** Which way the straight run faces, for the parts that sit on it. */
    const flat =
      facing === "South" ? Math.PI / 2 : facing === "North" ? -Math.PI / 2 : 0;

    for (let i = 0; i < count; i++) {
      const part =
        i === 1 || i === count - 1 ? "corner" : i % 2 === 1 ? "edge" : null;
      if (!part) continue;

      const weight = cushionWeight(straight[i], midZ, midX, BLEND_FLOOR);
      const keep = 1 - weight;
      const seat = blendPoint(nodes[i], straight[i], weight);
      const rotY =
        seat.x < 0
          ? keep * nodes[i].rotY + weight * flat + Math.PI
          : keep * nodes[i].rotY - weight * flat;

      placements.push({ part, position: [seat.x, -0.005, seat.z], rotY });
    }
  };

  side(2 * midX, "South", countX * OVERSAMPLE, stepX, Math.PI - corner, Math.PI + corner);
  side(2 * midZ, "West", countZ * OVERSAMPLE, stepZ, Math.PI + corner, 2 * Math.PI - corner);
  side(2 * midX, "North", countX * OVERSAMPLE, stepX, -corner, corner);
  side(2 * midZ, "East", countZ * OVERSAMPLE, stepZ, corner, Math.PI - corner);

  return { placements, beds, stoneCount: 2 * countZ + 2 * countX };
}
