/**
 * Model paths for baskets and halos, mirroring how the configurator selects them.
 *
 * It picks the part family from the stone's *outline character* rather than its name — a
 * marquise, pear and cushion all take the "Curved" basket blocks because their rims curve
 * the same way. The `_manufacturing` / `Manufacturing` suffixes its `extraMetal` mode adds
 * are not used here; nothing in this build renders that mode.
 */

/** Basket block family: the piece that sits at each prong. */
function basketBlockFamily(shape: string): string {
  if (shape === "Round") return "Round";
  if (shape === "Oval") return "Oval";
  if (shape === "Marquise" || shape === "Pear" || shape === "Cushion") {
    return "Curved";
  }
  return "Straight";
}

/** Plain-piece family: the filler between blocks. */
function basketPlainFamily(shape: string): string {
  if (shape === "Round" || shape === "Oval") return "RoundBlockDiag";
  if (shape === "Marquise" || shape === "Pear") return "RoundBlock";
  return "StraightBlock";
}

/** `0.15` and `0.23` are the two rim thicknesses the configurator ships. */
export function basketBlockModel(shape: string, thickness: 0.15 | 0.23): string {
  return `/models/using/basket/Block/${basketBlockFamily(shape)}Block${thickness}.glb`;
}

export function basketPlainModel(shape: string, side: "Left" | "Right"): string {
  return `/models/using/basket/Plain/${basketPlainFamily(shape)}Plain${side}.glb`;
}

/**
 * Halo blocks exist for six outlines. The three cut-corner shapes share the Asscher pieces
 * and a pear shares the marquise's, since both come to a point — the same substitution the
 * configurator's `CutCorner` switch implies.
 */
function haloFamily(shape: string): string {
  switch (shape) {
    case "Round":
      return "Round";
    case "Oval":
      return "Oval";
    case "Princess":
      return "Princess";
    case "Cushion":
      return "Cushion";
    case "Marquise":
    case "Pear":
      return "Marquise";
    case "Asscher":
    case "Emerald":
    case "Radiant":
      return "Asscher";
    default:
      return "Round";
  }
}

/** Whether this shape's halo has discrete corner pieces as well as edges. */
export function haloHasCorners(shape: string): boolean {
  const family = haloFamily(shape);
  return family !== "Round" && family !== "Oval";
}

export function haloEdgeModel(shape: string): string {
  return `/models/using/halo/block/${haloFamily(shape)}Edge.glb`;
}

export function haloCornerModel(shape: string, mirrored = false): string {
  const family = haloFamily(shape);
  const suffix = mirrored && family === "Asscher" ? "Mirrored" : "";
  return `/models/using/halo/block/${family}Corner${suffix}.glb`;
}

/** The arm that carries a halo down onto the band. */
export function haloArmModel(shape: string): string {
  const cutCorner =
    shape === "Asscher" || shape === "Emerald" || shape === "Radiant";
  return cutCorner
    ? "/models/using/halo/arm/ArmCutCornerStraight.glb"
    : "/models/using/halo/arm/Arm.glb";
}

/** Halo heads carry their own tips, cut to match a cut-corner outline where needed. */
export function haloTipModel(shape: string, tipId: string): string {
  const cutCorner =
    shape === "Asscher" || shape === "Emerald" || shape === "Radiant";
  const name =
    tipId === "Rounded"
      ? "RoundTip"
      : tipId === "Petite Claw"
        ? "PetiteClawTip"
        : tipId === "Tab"
          ? "TabTip"
          : "ClawTip";
  return `/models/using/halo/arm/${name}${cutCorner ? "CutCorner" : ""}.glb`;
}

/** Melee inside a basket or halo part are named like this; everything else is metal. */
export const isSetStone = (name: string) =>
  name.toLowerCase().startsWith("diamondmesh");
