/**
 * Halo layout contract.
 *
 * The configurator does not lay a halo out parametrically. It has one hand-built branch per
 * outline, each of which places corner pieces where the stone has corners, runs edge blocks
 * along the flats between them, and generates a metal bed underneath for the melee to sit in.
 * These types are the output of a faithful port of those branches: pure data, no THREE scene
 * graph, so the layout maths stays testable and the rendering stays declarative.
 */
import type * as THREE from "three";

/**
 * Which GLB a placement instances.
 *
 * `edgeWide` is the `*EdgeExtraMetal` block. Despite the name it has nothing to do with the
 * manufacturing/extra-metal export mode — a run picks it when the spacing it solved leaves a
 * gap too wide for the plain block to close.
 */
export type HaloPart = "edge" | "edgeWide" | "corner" | "cornerMirrored";

export type HaloPlacement = {
  part: HaloPart;
  position: [number, number, number];
  /** Every placement in the source is a pure yaw; no part is ever pitched or rolled. */
  rotY: number;
};

/** Generated metal under the melee — the rail the blocks are set into. */
export type HaloBed = {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  /** Applied in `YXZ` order, as the source sets it. */
  rotation: [number, number, number];
};

export type HaloInput = {
  /** Stone width, mm. */
  width: number;
  /** Stone length, mm. */
  length: number;
  /**
   * The source's `haloThicknessRatio` — the uncapped carat step. Every part is scaled by it
   * and every dimension below is derived from it, so it is the halo's single size input.
   */
  ratio: number;
};

export type HaloLayout = {
  placements: HaloPlacement[];
  beds: HaloBed[];
  /** Melee count, for the pavé report. */
  stoneCount: number;
};

/**
 * Melee diameter every halo is built from, before the carat ratio scales it. At 1ct the ratio
 * is 1.125, which lands 0.9mm — the "Pave Size 0.9mm" the source reports.
 */
export const HALO_STONE = 0.8;

/** Rim thickness: the melee inset a hair so the metal closes over its girdle. */
export const rimThickness = (ratio: number) => (HALO_STONE - 0.005) * ratio;

/**
 * Triangles whose every vertex sits below this in local z are dropped from a generated bed.
 *
 * The beds are built from whole tori and cylinders and then halved — the lower half would only
 * ever be buried inside the stone's pavilion, and leaving it in makes the melee read as
 * floating on a tube rather than set into a rail.
 */
export const BED_CLIP_Z = 0.01;
