/**
 * Round halo — a plain circular rail.
 *
 * Ported from the configurator's `"Round" == name` branch. The only shape whose halo needs no
 * corner pieces: the blocks run continuously around one circle, each turned to face outward.
 */
import { annulusRing, clippedTorus } from "./beds";
import {
  HALO_STONE,
  rimThickness,
  type HaloInput,
  type HaloLayout,
  type HaloPlacement,
} from "./types";

/** Segment count for both generated beds. */
const SEGMENTS = 100;

export function roundHalo({ width, ratio }: HaloInput): HaloLayout {
  const rim = rimThickness(ratio);
  /** Block-to-block pitch. Wider than the melee, so the metal between them survives. */
  const pitch = (HALO_STONE + 0.05) * ratio;

  const girdle = width / 2;
  /** Centre line of the rail — the circle the blocks and the bead both ride. */
  const centre = girdle + rim / 2;

  const count = Math.floor((2 * Math.PI * centre) / pitch);

  // The blocks sit a whisker inside the bead so their metal beds into it rather than perching
  // on the crest.
  const radius = centre - 0.021 * ratio;

  const placements: HaloPlacement[] = Array.from({ length: count }, (_, i) => {
    const theta = (i / count) * 2 * Math.PI;
    return {
      part: "edge",
      position: [radius * Math.cos(theta), 0, radius * Math.sin(theta)],
      rotY: -theta,
    };
  });

  return {
    placements,
    beds: [
      {
        geometry: annulusRing(girdle + rim, girdle, SEGMENTS),
        position: [0, 0.004, 0],
        rotation: [0, 0, 0],
      },
      {
        geometry: clippedTorus(centre, rim / 2, 30, SEGMENTS),
        position: [0, 0.004, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
    ],
    stoneCount: count,
  };
}
