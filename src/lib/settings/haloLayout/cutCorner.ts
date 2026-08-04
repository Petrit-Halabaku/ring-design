/**
 * Asscher, Emerald and Radiant — a rectangle with its corners cut off.
 *
 * Ported from the configurator's shared `"Asscher" || "Emerald" || "Radiant"` branch. All three
 * take the same parts and the same construction; only how deeply the corner is cut differs.
 *
 * Each of the four straight runs is capped at *both* ends by a corner piece — a plain one at
 * the start and a mirrored one at the finish. Two of those halves meet across every cut corner,
 * which is how the mitre closes. It is also why `AsscherCornerMirrored.glb` exists at all, and
 * why nothing rendered correctly while the layout only ever reached for edge blocks.
 */
import { clippedCylinder } from "./beds";
import {
  HALO_STONE,
  rimThickness,
  type HaloInput,
  type HaloLayout,
  type HaloPart,
  type HaloPlacement,
} from "./types";

const SEGMENTS = 100;

/** How far in each shape cuts its corners, as a fraction of the outer width. */
const CORNER_CUT: Record<string, number> = {
  Asscher: 0.15018,
  Emerald: 0.2026,
  Radiant: 0.15308,
};

export function cutCornerHalo(
  shape: string,
  { width, length, ratio }: HaloInput,
): HaloLayout {
  const rim = rimThickness(ratio);
  const pitch = (HALO_STONE + 0.1) * ratio;
  const bead = rim / 2;

  const outerWidth = width + rim;
  const outerLength = length + rim;

  const cut = (CORNER_CUT[shape] ?? CORNER_CUT.Asscher) * outerWidth;
  /** The flat left between the cuts, on each axis. */
  const flatX = outerWidth - 2 * cut;
  const flatZ = outerLength - 2 * cut;
  /** How much of the cut the corner pieces themselves take back. */
  const reclaim = 2 * (cut - pitch / Math.SQRT2);

  const spanX = flatX + reclaim;
  const spanZ = flatZ + reclaim;
  const countX = Math.floor(spanX / pitch);
  const countZ = Math.floor(spanZ / pitch);
  const stepX = spanX / countX;
  const stepZ = spanZ / countZ;

  // A run whose step opened up past two melee widths switches to the wider block.
  const wide = 2 * HALO_STONE * ratio;
  const edgeX: HaloPart = stepX - pitch < wide ? "edge" : "edgeWide";
  const edgeZ: HaloPart = stepZ - pitch < wide ? "edge" : "edgeWide";

  const halfX = outerWidth / 2;
  const halfZ = outerLength / 2;
  const y = -0.005;

  const beds: HaloLayout["beds"] = [
    // The two runs along x sit on the ±z sides, and vice versa.
    {
      geometry: clippedCylinder(bead, spanX - rim / 2, SEGMENTS),
      position: [0, 0, -halfZ],
      rotation: [Math.PI / 2, Math.PI / 2, 0],
    },
    {
      geometry: clippedCylinder(bead, spanX - rim / 2, SEGMENTS),
      position: [0, 0, halfZ],
      rotation: [Math.PI / 2, Math.PI / 2, 0],
    },
    {
      geometry: clippedCylinder(bead, spanZ - rim / 2, SEGMENTS),
      position: [halfX, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      geometry: clippedCylinder(bead, spanZ - rim / 2, SEGMENTS),
      position: [-halfX, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
  ];

  const placements: HaloPlacement[] = [];

  /**
   * Lays one run out. `at` turns the step index into a seat; the two corner rotations differ
   * from the edge rotation on three of the four runs, so all three are passed in.
   */
  const run = (
    count: number,
    edge: HaloPart,
    startRot: number,
    edgeRot: number,
    endRot: number,
    at: (i: number) => [number, number, number],
  ) => {
    for (let i = 0; i <= count; i++) {
      const part: HaloPart =
        i === 0 ? "corner" : i === count ? "cornerMirrored" : edge;
      const rotY = i === 0 ? startRot : i === count ? endRot : edgeRot;
      placements.push({ part, position: at(i), rotY });
    }
  };

  const half = Math.PI / 2;

  run(countX, edgeX, half, half, 0, (i) => [-spanX / 2 + stepX * i, y, -halfZ]);
  run(countZ, edgeZ, 0, 0, -half, (i) => [halfX, y, -spanZ / 2 + stepZ * i]);
  run(countX, edgeX, -half, -half, Math.PI, (i) => [spanX / 2 - stepX * i, y, halfZ]);
  run(countZ, edgeZ, Math.PI, Math.PI, half, (i) => [-halfX, y, spanZ / 2 - stepZ * i]);

  return {
    placements,
    beds,
    stoneCount: 2 * (countX + 1) + 2 * (countZ + 1),
  };
}
