/**
 * Oval halo — a true ellipse, with the blocks spaced by arc length rather than by angle.
 *
 * Ported from the configurator's `"Oval" == name` branch. The spacing is the whole point: step
 * the parameter evenly instead and the melee crowd at the ends and gap along the flanks, which
 * is exactly the failure a superellipse ring produces.
 *
 * The source oversamples by two and then places a block at every second node, so the pitch it
 * reports and the pitch it draws stay in step even when the perimeter divides awkwardly.
 */
import { ovalBed } from "./beds";
import {
  advanceOval,
  ellipseNodes,
  ellipsePerimeter,
  type OutlineNode,
} from "./outline";
import {
  HALO_STONE,
  rimThickness,
  type HaloInput,
  type HaloLayout,
  type HaloPlacement,
} from "./types";

const SEGMENTS = 100;
/** The source generates two nodes per block and uses every other one. */
const OVERSAMPLE = 2;

export function ovalHalo({ width, length, ratio }: HaloInput): HaloLayout {
  const rim = rimThickness(ratio);
  const pitch = (HALO_STONE + 2 * 0.05) * ratio;

  const innerX = width / 2;
  const innerZ = length / 2;
  const outerX = innerX + rim;
  const outerZ = innerZ + rim;
  /** Centre line of the rail — what the blocks ride and the perimeter is measured on. */
  const midX = innerX + rim / 2;
  const midZ = innerZ + rim / 2;

  const perimeter = ellipsePerimeter(midZ, midX);
  const blocks = Math.floor(perimeter / pitch);
  const step = perimeter / blocks / OVERSAMPLE;
  const nodeCount = blocks * OVERSAMPLE;

  const thetas = [0];
  for (let i = 0; i < nodeCount - 1; i++) {
    thetas.push(advanceOval(thetas[thetas.length - 1], step, midZ, midX));
  }

  // Nudged in off the centre line so the block beds into the rail rather than sitting on it.
  // Only the seat moves: the source reads each block's facing off the un-nudged ellipse, so the
  // rail's own tangent still sets it.
  const nudge = 0.0019 * ratio;
  const facing: OutlineNode[] = ellipseNodes(thetas, midZ, midX);
  const seat = ellipseNodes(thetas, midZ - nudge, midX - nudge);
  const nodes = facing.map((node, i) => ({
    ...node,
    x: seat[i].x,
    z: seat[i].z,
  }));

  /** Past halfway the outline's tangent has turned through π, so the block has to follow. */
  const halfway = 2 * Math.floor(blocks / 2);
  const first = (blocks + 1) % 2;

  const placements: HaloPlacement[] = [];
  for (let i = first; i < nodes.length; i += OVERSAMPLE) {
    placements.push({
      part: "edge",
      position: [nodes[i].x, 0, nodes[i].z],
      rotY: i > halfway ? nodes[i].rotY + Math.PI : nodes[i].rotY,
    });
  }

  return {
    placements,
    beds: [
      {
        geometry: ovalBed(innerX, innerZ, outerX, outerZ, rim, SEGMENTS),
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
    ],
    stoneCount: Math.floor((nodes.length - 1 - first) / 2 + 1),
  };
}
