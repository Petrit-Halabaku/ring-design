import * as THREE from "three";
import type { GlbMesh } from "./useGlbMeshes";

/**
 * The configurator's prong parts share one authored space, which the GLBs make explicit:
 *
 *   y = height along the prong   z = radial (outward)   x = tangential (prong width)
 *
 * Every part is x ±0.45mm wide and carries one or two `*Pointer*` locator meshes — tiny
 * 0.06mm nubs that mark where the next part joins. `Middle4` runs y 0.55 → 4.25 with
 * pointers at both ends; a tip (`ClawTip`, `WedgeTip50`, …) starts at y 2.45 with its
 * pointer there. So a prong is assembled by sliding a tip up until its pointer meets the
 * arm's top pointer, and the arm is stretched so that join lands on the stone's girdle.
 */

/** Height of a part's join locator, in millimetres. */
export type PartAnchors = {
  /** Lowest pointer (where this part attaches to what's below it). */
  bottom: number;
  /** Highest pointer (where the next part attaches). */
  top: number;
  /** Radial offset of the pointer axis. */
  radial: number;
};

const isPointer = (m: GlbMesh) => /pointer/i.test(m.name);

/** World-space centre of a mesh, with its node transform applied. */
function meshCentre(mesh: GlbMesh) {
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrix);
  g.computeBoundingBox();
  const c = g.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
  g.dispose();
  return c;
}

/** Reads the join heights out of a part's locator meshes. */
export function readAnchors(meshes: GlbMesh[]): PartAnchors {
  const centres = meshes.filter(isPointer).map(meshCentre);
  if (centres.length === 0) return { bottom: 0, top: 0, radial: 0 };

  const ys = centres.map((c) => c.y);
  return {
    bottom: Math.min(...ys),
    top: Math.max(...ys),
    radial: centres[0].z,
  };
}

/** The drawable geometry — everything that isn't a locator. */
export const drawable = (meshes: GlbMesh[]) => meshes.filter((m) => !isPointer(m));

/**
 * Bakes each part's node transform into its geometry, leaving an identity matrix behind.
 *
 * This is what puts the parts into one shared millimetre space. The GLBs carry a ×100 root
 * scale, and `Bottom.glb` additionally carries a −90° rotation about X — its geometry runs
 * along +z where the middle and tip run along +y. Baking resolves both, so afterwards every
 * part measures in millimetres along a common +y axis and the pointers line up: a baked
 * `Bottom` ends at y 0.550 and a baked `Middle3` starts its bottom pointer at exactly 0.550.
 */
export function bakeToMillimetres(meshes: GlbMesh[]): GlbMesh[] {
  return meshes.map((m) => {
    const geometry = m.geometry.clone();
    geometry.applyMatrix4(m.matrix);
    geometry.computeBoundingBox();
    return { ...m, geometry, matrix: new THREE.Matrix4() };
  });
}

/** The stalk that sits on the band. Stretched along +y to take up the arm's remainder. */
export const PRONG_BOTTOM = "/models/using/prongarm/bottom/Bottom.glb";

/** `Middle{n}.glb` — whole 0.9mm arm segments, n = 1…7. */
export function middleModel(segments: number, pave = false): string {
  const n = Math.min(7, Math.max(1, segments));
  return `/models/using/prongarm/middle/Middle${n}${pave ? "Pave" : ""}.glb`;
}

/**
 * `WedgeTip{angle}.glb`, cut at 5° steps. These are only used for Classic and Bezel
 * basket-halo heads; a plain solitaire takes the styled tip from the settings API instead.
 */
export function wedgeTipModel(angle: number, pave = false): string {
  return `/models/using/prongarm/tip/WedgeTip${angle}${pave ? "Pave" : ""}.glb`;
}

/**
 * Tips, keyed by the id the settings API uses. The wedge pieces are shorter alternates
 * that sit flush rather than curling over the girdle.
 */
export const PRONG_TIP_MODELS: Record<string, string> = {
  Rounded: "/models/RoundTip.glb",
  Claw: "/models/ClawTip.glb",
  "Petite Claw": "/models/PetiteClawTip.glb",
  Tab: "/models/TabTip.glb",
  "Wedge 50": "/models/prong/WedgeTip50.glb",
  "Wedge 65": "/models/prong/WedgeTip65.glb",
};

/**
 * `Tip{angle}Manufacturing.glb` are *drawable* tips, not boolean volumes: the vendor swaps
 * them in for the styled tip when its `extraMetal` flag is on, and they never reach a CSG
 * evaluator. The only boolean volume in the prong pipeline is
 * `bottom_manufacturing_csg/BottomManufacturingCSG.glb`, which the *band* subtracts once per
 * prong to cut the seat where the arm lands — and that too is gated on `extraMetal`.
 *
 * Nothing here is needed to render a normal head; it is listed so the set is documented.
 */
export const MANUFACTURING_MODELS = [
  "/models/using/prongarm/tip_manufacturing/Tip50Manufacturing.glb",
  "/models/using/prongarm/tip_manufacturing/Tip65Manufacturing.glb",
];
