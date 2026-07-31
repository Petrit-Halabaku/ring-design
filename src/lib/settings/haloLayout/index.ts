/**
 * Per-outline halo layouts, ported from the configurator's own branches.
 *
 * A shape with no branch here returns `null` and the caller falls back to the old parametric
 * ring. That fallback is a placeholder, not a design: it wraps one superellipse around every
 * outline and never places a corner piece, which is why cornered stones look wrong under it.
 * Each shape ported below deletes one more case of it.
 */
import { princessHalo } from "./princess";
import { roundHalo } from "./round";
import type { HaloInput, HaloLayout } from "./types";

export type { HaloInput, HaloLayout, HaloPart, HaloPlacement, HaloBed } from "./types";

export function haloLayout(shape: string, input: HaloInput): HaloLayout | null {
  switch (shape) {
    case "Round":
      return roundHalo(input);
    case "Princess":
      return princessHalo(input);
    default:
      return null;
  }
}
