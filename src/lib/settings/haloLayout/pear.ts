/**
 * Pear halo — pointed at one end, round at the other.
 *
 * Ported from the configurator's `"Pear" == name` branch. It is the marquise construction cut
 * in half: the rhombus it blends toward exists only over `z <= 0`, so that end draws to a point
 * while the other keeps the ellipse's curve. Where the rhombus has collapsed the blend is
 * skipped entirely and the ellipse point stands.
 *
 * Because only half the outline is laid out that way, the source walks the pointed flank once
 * and mirrors each block across x, then fills the round end separately with a plain arc of
 * blocks. Those are two different placements of the same `MarquiseEdge` part.
 */
import { blendedBed } from "./beds";
import {
  arcSpacedThetas,
  blendPoint,
  ellipsePerimeter,
  isCollapsed,
  pearEllipseNodes,
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
const TAPER = 0.55;
const OVERSAMPLE = 2;

/** One blended ring, leaving the ellipse untouched wherever the rhombus has collapsed. */
function blendedRing(
  count: number,
  x: number,
  z: number,
  overhang: number,
): PlanePoint[] {
  const nodes = pearEllipseNodes(arcSpacedThetas(count, z, x), z, x);
  const rhombus = rhombusPoints(count, z + overhang, x, true);
  return nodes.map((node, i) =>
    isCollapsed(rhombus[i])
      ? { x: node.x, z: node.z }
      : blendPoint(node, rhombus[i], taperWeight(rhombus[i], x, TAPER)),
  );
}

/** Length of the polyline, first span counted twice — the source's own measure. */
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

export function pearHalo({ width, length, ratio }: HaloInput): HaloLayout {
  const rim = rimThickness(ratio);
  const pitch = (HALO_STONE + 2 * 0.05) * ratio;

  const innerX = width / 2;
  // Measured from the widest point to the tip, not from the centre — a pear is not symmetric
  // about its waist, and this is the same span the prong table calls the tip.
  const innerZ = length - width / 2;
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

  const perimeter = traversed(blendedRing(RING_POINTS, midX, midZ, rim / 2));
  /** The round end is a half-circle of radius `midX`; the rest is the pointed flank. */
  const roundArc = Math.PI * midX;
  const flankBlocks = Math.floor((perimeter - roundArc) / pitch);

  const nodeCount = 2 * flankBlocks * OVERSAMPLE;
  const flankStep = (perimeter - roundArc) / flankBlocks;

  const nodes = pearEllipseNodes(
    arcSpacedThetas(nodeCount, midZ, midX, ellipsePerimeter(midZ, midX) / nodeCount),
    midZ,
    midX,
  );
  const rhombus = rhombusPoints(nodeCount, midZ + rim / 2, midX, true);
  const seats = nodes.map((node, i) =>
    isCollapsed(rhombus[i])
      ? { x: node.x, z: node.z }
      : blendPoint(node, rhombus[i], taperWeight(rhombus[i], midX, TAPER)),
  );

  const placements: HaloPlacement[] = [];
  /** Outermost block placed on the pointed flank — where the round end has to pick up. */
  let handover: PlanePoint = { x: 0, z: 0 };

  for (let i = 0; i < nodeCount / 2; i++) {
    if (i === 0) {
      placements.push({
        part: "corner",
        position: [seats[0].x, 0, seats[0].z],
        rotY: Math.PI / 2,
      });
      continue;
    }
    if (i % 2 !== 0 || seats[i].z >= 0) continue;

    const rotY = Math.atan(
      (seats[i + 1].x - seats[i - 1].x) / (seats[i + 1].z - seats[i - 1].z),
    );
    if (seats[i].x > 0) handover = seats[i];

    placements.push({
      part: "edge",
      position: [seats[i].x, 0, seats[i].z],
      rotY,
    });
    // Its mirror image across the ring's long axis.
    placements.push({
      part: "edge",
      position: [-seats[i].x, 0, seats[i].z],
      rotY: -rotY - Math.PI,
    });
  }

  // Fill the round end with a plain arc, starting where the flank left off.
  const bearing = Math.atan(Math.abs(handover.z) / handover.x);
  const consumed = flankStep / midX;
  const sweep = Math.PI + 2 * bearing - consumed;
  const roundBlocks = Math.floor((sweep * midX) / pitch);

  if (Number.isFinite(roundBlocks) && roundBlocks > 0) {
    const step = sweep / roundBlocks / 2;
    for (let i = 0; i < roundBlocks; i++) {
      const angle = 2 * step - bearing + 2 * i * step;
      placements.push({
        part: "edge",
        position: [midX * Math.cos(angle), 0, midX * Math.sin(angle)],
        rotY: -angle,
      });
    }
  }

  return {
    placements,
    beds,
    stoneCount:
      2 * Math.floor(nodeCount / 8) +
      1 +
      (Number.isFinite(roundBlocks) ? Math.max(roundBlocks, 0) : 0),
  };
}
