/**
 * Princess halo — four straight rails meeting at four corner pieces.
 *
 * Ported from the configurator's `"Princess" == name` branch. This is the shape that shows why
 * a single parametric outline cannot stand in for the real thing: the corners are their own
 * authored part, mitred to turn ninety degrees, and the straight runs are spaced to land
 * *between* them rather than swept continuously around a curve.
 *
 * The branch reads the stone's **width for both axes** and never touches its length — a
 * princess is square by construction, so its halo is too.
 */
import { clippedCylinder } from "./beds";
import {
  HALO_STONE,
  rimThickness,
  type HaloInput,
  type HaloLayout,
  type HaloPlacement,
} from "./types";

const SEGMENTS = 100;

export function princessHalo({ width, ratio }: HaloInput): HaloLayout {
  const rim = rimThickness(ratio);
  /** Block-to-block pitch along a run. Wider than the round's — the runs are straight. */
  const pitch = (HALO_STONE + 0.1) * ratio;

  const bead = rim / 2;
  const girdle = width / 2;
  /** Distance out to each rail's centre line, on all four sides. */
  const out = girdle + bead;

  // One straight bead per side. The two z-facing rails carry an extra quarter turn about y so
  // their clipped face still points up after the pitch that stands them on their side.
  const beds: HaloLayout["beds"] = [
    {
      geometry: clippedCylinder(bead, width, SEGMENTS),
      position: [0, 0, -out],
      rotation: [Math.PI / 2, Math.PI / 2, 0],
    },
    {
      geometry: clippedCylinder(bead, width, SEGMENTS),
      position: [0, 0, out],
      rotation: [Math.PI / 2, Math.PI / 2, 0],
    },
    {
      geometry: clippedCylinder(bead, width, SEGMENTS),
      position: [out, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      geometry: clippedCylinder(bead, width, SEGMENTS),
      position: [-out, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
    },
  ];

  const corners: HaloPlacement[] = [
    { part: "corner", position: [out, 0, -out], rotY: 0 },
    { part: "corner", position: [out, 0, out], rotY: -Math.PI / 2 },
    { part: "corner", position: [-out, 0, -out], rotY: Math.PI / 2 },
    { part: "corner", position: [-out, 0, out], rotY: Math.PI },
  ];

  /** Run length to fill: corner to corner, plus the rim the corners themselves occupy. */
  const span = width + rim;
  const count = Math.floor(span / pitch);
  /** Slack left over, shared out evenly between the blocks. */
  const gap = (span - count * pitch) / count;

  // Too much slack for the plain block to close, so the run switches to the wider one.
  const part: HaloPlacement["part"] = gap < HALO_STONE * ratio ? "edge" : "edgeWide";

  /** Pulls each block in off the rail's centre line, onto the bead. */
  const inset = 0.019 * ratio;
  const y = -0.005;

  const edges: HaloPlacement[] = [];
  for (let i = 0; i < count - 1; i++) {
    // Every run walks inward from its corner by the same step, so one offset serves all four.
    const along = out - (i + 1) * (gap + pitch);
    edges.push(
      { part, position: [out - inset, y, -along], rotY: 0 },
      { part, position: [-out + inset, y, -along], rotY: Math.PI },
      { part, position: [-along, y, -out + inset], rotY: Math.PI / 2 },
      { part, position: [-along, y, out - inset], rotY: -Math.PI / 2 },
    );
  }

  return {
    placements: [...corners, ...edges],
    beds,
    stoneCount: 4 * count,
  };
}
