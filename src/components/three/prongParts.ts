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

export const PRONG_ARMS = {
  /** Standard arm. Its natural span between pointers is 3.70mm. */
  middle4: "/models/prong/Middle4.glb",
  /** Longer arm, for taller settings. */
  middle5: "/models/prong/Middle5.glb",
} as const;

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
 * `Tip50Manufacturing` / `Tip65Manufacturing` are boolean volumes — the vendor subtracts
 * them from the arm with three-bvh-csg to cut the tip's seat. They are deliberately not
 * rendered; drawing them would just show a block where the seat should be.
 */
export const MANUFACTURING_MODELS = [
  "/models/prong/Tip50Manufacturing.glb",
  "/models/prong/Tip65Manufacturing.glb",
];
