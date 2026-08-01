/**
 * Per-outline halo layouts, ported from the configurator's own branches.
 *
 * Every shape the configurator supports has its own hand-built construction here. There is no
 * shared parametric ring, because there isn't one in the source either — a princess is four
 * straight rails meeting at mitred corners, an oval is arc-length spacing around a true ellipse,
 * and a cushion, marquise and pear are each an ellipse blended toward a different polygon.
 *
 * A shape with no branch still returns `null`, and the caller falls back to the old superellipse
 * ring. Nothing the configurator ships reaches that path any more.
 */
import { cushionHalo } from "./cushion";
import { cutCornerHalo } from "./cutCorner";
import { marquiseHalo } from "./marquise";
import { ovalHalo } from "./oval";
import { pearHalo } from "./pear";
import { princessHalo } from "./princess";
import { roundHalo } from "./round";
import type { HaloInput, HaloLayout } from "./types";

export type { HaloInput, HaloLayout, HaloPart, HaloPlacement, HaloBed } from "./types";

export function haloLayout(shape: string, input: HaloInput): HaloLayout | null {
  switch (shape) {
    case "Round":
      return roundHalo(input);
    case "Oval":
      return ovalHalo(input);
    case "Princess":
      return princessHalo(input);
    case "Cushion":
      return cushionHalo(input);
    case "Asscher":
    case "Emerald":
    case "Radiant":
      return cutCornerHalo(shape, input);
    case "Marquise":
      return marquiseHalo(input);
    case "Pear":
      return pearHalo(input);
    default:
      return null;
  }
}
