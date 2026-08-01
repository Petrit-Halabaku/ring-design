"use client";

import { Suspense, useDeferredValue, useLayoutEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  MeshRefractionMaterial,
  OrbitControls,
  useEnvironment,
} from "@react-three/drei";
import * as THREE from "three";
import { useGlbMeshes } from "./useGlbMeshes";
import {
  bakeToMillimetres,
  drawable,
  middleModel,
  PRONG_BOTTOM,
  readAnchors,
  wedgeTipModel,
} from "./prongParts";
import {
  basketBlockModel,
  basketPlainModel,
  haloArmModel,
  haloEdgeModel,
  haloPartModel,
  haloTipModel,
  isSetStone,
} from "./basketHaloParts";
import {
  haloLayout,
  type HaloPlacement,
} from "@/lib/settings/haloLayout";
import { rimThickness } from "@/lib/settings/haloLayout/types";
import { bezelGeometry, bezelHeight } from "@/lib/settings/bezelGeometry";
import {
  basketHeight,
  basketMeasurements,
  haloHeight,
  outlineExponent,
  outlinePerimeter,
  outlineRadius,
  rimLayout,
  ringFrames,
  type BasketMeasurements,
  type RimFrame,
} from "@/lib/settings/basketGeometry";
import {
  basketHaloStyle,
  isCagedStyle,
  rimShowsStones,
  usesBasketRim,
} from "@/lib/settings/basketHalo";
import { stoneDimensionsAtCarat } from "@/lib/settings/geometry";
import {
  haloThicknessRatio,
  headOffsets,
  MIDDLE_SPANS,
  MIDDLE_SPANS_PAVE,
  PRONG_SEAT,
  prongASides,
  prongWidthAtCarat,
  solveProngArm,
  splitProngArm,
  wedgeTipAngle,
} from "@/lib/settings/prongGeometry";
import type { Stone } from "@/lib/settings/types";

/**
 * Rebuild of the configurator's render pipeline (react-three-fiber + drei).
 *
 * How the stone is made to shine — the vendor's recipe, read out of their bundle:
 *
 *   1. `diamond (1).hdr` is loaded with `useLoader(RGBELoader, …)` and handed to drei's
 *      MeshRefractionMaterial as `envMap`. The material ray-marches that environment
 *      through a BVH of the stone's own geometry, so every facet refracts the surroundings.
 *   2. The HDR is a photograph of a room — deep blue curtains, lamps, a bright window.
 *      Median luminance 0.33, p99 14.9, peak 207. That range is the whole effect: a
 *      refracted ray either lands on a lamp (a burst of fire) or on dark fabric, and the
 *      contrast between them reads as sparkle. A flat studio HDR gives a lifeless blob.
 *   3. Their exact numbers (DIAMOND_MATERIAL below). Two do the heavy lifting: `ior: 2.75`,
 *      well above diamond's real 2.417, which exaggerates the bend; and an over-white
 *      `color` of 1.85 that lifts exposure without washing the fire out.
 *
 * The vendor also uses drei's <CubeCamera resolution={256} frames={1}> — but only for pavé
 * and halo melee, which need to reflect their immediate surroundings. The centre stone
 * doesn't.
 *
 * One deviation, forced by a drei change: current drei only samples a raw equirect through
 * a CubeUV atlas lookup (which expects a PMREM texture), so the HDR is projected onto a
 * real cube target here to reach the plain `samplerCube` path. See useCubeEnv — getting the
 * texture type and the mip chain right on that target is what separates a pale, brilliant
 * stone from a dark navy one.
 *
 * Metal is MeshPhysicalMaterial lit by `env_metal_flat.hdr` (a flat 512² grey, uniform 1.4).
 * The studio backdrop is a CSS background behind a transparent canvas, exactly as the
 * original does it (`.wrapper`).
 *
 * Units: the vendor's models don't share one convention. The diamonds are authored at
 * 1 unit = 100mm (a 1ct round measures 0.064 × 0.0394, matching the API's 6.4 × 3.935mm)
 * with no root scale; the metal parts carry a ×100 root scale that lands them in
 * millimetres. So each part is measured and scaled to the millimetre size the API reports
 * rather than trusting its units. Origins: diamond at the culet, claw tip on the girdle
 * plane. This scene works in millimetres.
 *
 * Not reproduced: the vendor assembles the shank from a swept profile piece
 * (`Band0.9Piece0.22`) with three-bvh-csg boolean operations. The shank here is procedural,
 * driven by the real ring-size and band-width controls.
 */

const DIAMOND_HDR = "/hdr/diamond1.hdr";
const METAL_HDR = "/hdr/env_metal_flat.hdr";

// Prong pavé is not a separate pass: the configurator carries the melee inside the arm
// itself, as `diamondmesh…` meshes in `Middle{n}Pave.glb`. `DiamondPave.glb` is only used
// for band and halo pavé.

/**
 * The vendor's MeshRefractionMaterial settings. Everything is theirs verbatim except
 * `color`, which they leave a neutral over-white 1.85.
 *
 * It is raised here because the cube projection this build has to use (see useCubeEnv)
 * reads darker than their equirect path. It stays neutral — the probe's blue cast is
 * corrected at the source instead, by desaturating the environment itself.
 */
const DIAMOND_MATERIAL = {
  bounces: 6,
  aberrationStrength: 0.01,
  ior: 2.75,
  fresnel: 1,
  color: new THREE.Color(2.7, 2.7, 2.7),
  fastChroma: true,
} as const;

/** How far the stone's probe is pulled toward neutral. See useCubeEnv. */
const STONE_DESATURATION = 0.8;

/**
 * Floor added to the stone's probe.
 *
 * `diamond (1).hdr` is a real room, so most directions in it are dark walls and fabric. A
 * 1ct stone hides that — its facets are only a few pixels each, so the eye reads the
 * scattered bright hits as sparkle. Enlarge the stone and each facet resolves into a broad,
 * mostly-dark patch, and the middle goes brown and glassy. Lifting the dark end of the
 * probe is what a jeweller does with a light box: it fills the directions that would
 * otherwise return nothing, so a 3ct stone stays bright. Highlights are untouched, so the
 * fire survives.
 */
const STONE_FILL = 0.16;

/** US ring size → inner diameter in millimetres. */
const innerDiameterMm = (usSize: number) => 11.63 + 0.8128 * usSize;

export type SceneProps = {
  stone: Stone;
  /** Local path to the stone's GLB (mirrors the API's `glbUrl`). */
  stoneModel: string;
  carat: number;
  /** Hex from the metal-colour API record. */
  metalColor: string;
  ringSize?: number;
  bandWidthMm?: number;
  /** Prong azimuths in radians, from lib/settings/prongs. */
  prongAngles?: number[];
  /** Layout name ("4 Classic", "6 Prong", …). Picks the head's radial seats. */
  prongCountType?: string;
  /** Local path to the selected prong tip's GLB. */
  prongTipModel?: string;
  /** Tip id ("Claw", "Rounded", …) — a halo needs it to pick its own matching tip. */
  prongTipId?: string;
  /** Prongs can take a different metal from the band (the configurator's "Mixed"). */
  prongMetalColor?: string;
  prongPave?: boolean;
  /** Basket & halo style id, from lib/settings/basketHalo. */
  basketHalo?: string;
  /** A cathedral band lifts a classic basket; see prongGeometry.headOffsets. */
  cathedral?: boolean;
};

/**
 * The configurator's metal, matched exactly: `new MeshStandardMaterial({ color, metalness: 1,
 * roughness: 0.05 })` lit by `env_metal_flat.hdr`, with `envMapIntensity` left at its default
 * of 1.
 *
 * All three of those matter to the colour. This used to be a MeshPhysicalMaterial at
 * roughness 0.15 with envMapIntensity 1.5 — the extra roughness spread the flat probe into a
 * broad wash and the extra intensity lifted it past the colour, which is why the gold came
 * out pale and chalky instead of the source's deeper, sharper yellow. The hexes were never
 * wrong (#ffcb7d for both yellows, matching their records).
 */
function useMetalMaterial(color: string) {
  const env = useEnvironment({ files: METAL_HDR });
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 1,
      roughness: 0.05,
    });
    m.envMap = env;
    return m;
  }, [color, env]);

  useLayoutEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * MeshRefractionMaterial has two sampling paths: a plain `samplerCube` when handed a
 * CubeTexture, or a CubeUV atlas lookup otherwise — the latter expects a PMREM-processed
 * texture, so a raw equirectangular HDR gets read as an atlas and comes out as coloured
 * mush. Projecting the HDR onto a real cube target puts it on the well-defined path.
 */
function useCubeEnv(file: string, desaturate = 0, fill = 0) {
  const equirect = useEnvironment({
    files: file,
    // Load as full floats so the probe can be rebalanced below without losing its range.
    extensions: (loader) =>
      (loader as unknown as {
        setDataType?: (t: THREE.TextureDataType) => void;
      }).setDataType?.(THREE.FloatType),
  });
  const gl = useThree((s) => s.gl);

  /**
   * `diamond (1).hdr` is a photograph of a room with deep blue curtains, and refracted rays
   * land on that fabric far more often than on the window — so the stone comes out blue
   * where the live site renders it pale ice-white. Pulling each texel toward its own
   * luminance removes the cast while leaving the light/dark structure exactly as it was,
   * which is what produces the fire. A colour multiplier can't do this: it scales the blue
   * along with everything else.
   */
  const probe = useMemo(() => {
    const src = equirect.image as { data?: ArrayLike<number>; width: number; height: number };
    if (!(desaturate || fill) || !(src.data instanceof Float32Array)) return equirect;

    const data = Float32Array.from(src.data);
    for (let i = 0; i < data.length; i += 4) {
      const lum =
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      data[i] += (lum - data[i]) * desaturate;
      data[i + 1] += (lum - data[i + 1]) * desaturate;
      data[i + 2] += (lum - data[i + 2]) * desaturate;
      data[i] += fill;
      data[i + 1] += fill;
      data[i + 2] += fill;
    }

    const tex = new THREE.DataTexture(
      data,
      src.width,
      src.height,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [equirect, desaturate, fill]);

  return useMemo(() => {
    const target = new THREE.WebGLCubeRenderTarget(512);
    // WebGLCubeRenderTarget defaults to an 8-bit texture. This probe peaks at 207, so
    // writing it to 8 bits crushes everything into 0..1 — the stone renders navy with
    // clipped speckles instead of pale ice-white. drei's own CubeCamera sets this too.
    target.texture.type = THREE.HalfFloatType;
    // No mip chain on purpose. The shader samples with screen-space gradients, so at the
    // size the stone actually occupies, mips average this probe's tiny bright lamps into
    // the dark curtains around them — the fire disappears and the stone goes flat and
    // muddy. Sampling the base level keeps the highlight contrast that reads as sparkle.
    target.texture.generateMipmaps = false;
    target.texture.minFilter = THREE.LinearFilter;
    target.texture.magFilter = THREE.LinearFilter;
    target.fromEquirectangularTexture(gl, probe);
    return target.texture;
  }, [gl, probe]);
}

/** World-space bounds of a set of GLB meshes, with their node transforms applied. */
function meshBounds(meshes: ReturnType<typeof useGlbMeshes>) {
  const box = new THREE.Box3();
  meshes.forEach((m) => {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrix);
    g.computeBoundingBox();
    if (g.boundingBox) box.union(g.boundingBox);
    g.dispose();
  });
  return box;
}

/**
 * Bakes each mesh's node transform *and* the millimetre conversion into a cloned geometry,
 * so the stone's object space is millimetres at 1ct and the model matrix is left carrying
 * only the carat factor.
 *
 * This is load-bearing, not tidiness. MeshRefractionMaterial ray-marches in the geometry's
 * own object space, and the epsilons involved are absolute lengths in that space:
 * three-mesh-bvh accepts any triangle with `dist + 1e-5 >= 0` and keeps the numerically
 * smallest `dist` with no lower bound, so a facet up to 1e-5 *behind* the ray origin is
 * returned as the nearest hit. drei seeds the ray with a world-space nudge of 0.001 and
 * then divides it by the model matrix, so it lands in object space as 0.001 / scale.
 *
 * The diamond GLBs are authored at 1 unit = 100mm with their 1ct size baked in, which puts
 * `scale` at 100 × carat^W — passing through exactly 100 at exactly 1.00ct. So the nudge
 * arrives as exactly 1e-5 at 1ct and falls *under* the BVH's epsilon above it: the ray
 * self-intersects the facet it started on, `max(dist - 0.001, 0.0)` clamps it back to its
 * own origin, and every bounce is consumed without ever entering the stone. Each pixel
 * then samples nearly the same environment direction and the stone renders as flat milky
 * white — which STONE_FILL makes paler still, since it lifts exactly the dark directions
 * that a stuck ray keeps returning. Round/Oval/Princess/Pear/Marquise/Asscher all break at
 * 1.00ct, Cushion at 1.15, Radiant at 1.21; Emerald is authored in millimetres and never
 * breaks.
 *
 * With the conversion baked in, object space is millimetres, the carat factor stays in
 * ~0.8–1.4, and the nudge holds at ~7e-4 — two orders of magnitude clear of the epsilon.
 * It also puts drei's 0.01 inter-bounce offset at 0.01mm rather than a quarter of the
 * stone's depth, so the pavilion actually gets traversed.
 *
 * Baking once per model (not per carat) also keeps the geometry identity stable while the
 * slider moves: drei builds its BVH in a mount-time effect and never rebuilds it, so a
 * geometry that changed with carat would leave the BVH stale.
 */
function useMillimetreGeometries(
  meshes: ReturnType<typeof useGlbMeshes>,
  /**
   * Target width in millimetres. Omit for models whose node transform already lands them
   * in millimetres (the pavé melee, cut at a fixed size) — baking that transform is then
   * all that's needed.
   */
  widthMm?: number,
  /**
   * Drop the node hierarchy's translation, keeping only its rotation and scale.
   *
   * The configurator reads a centre stone as `scene.children[0].geometry` — the raw buffer,
   * with no node transform applied at all — so any translation authored into the hierarchy is
   * simply never seen. Eight of the nine stones are authored with none, but
   * `EmeraldDiamond.glb` carries one on `Emerald_MainMin001`, which under its ×1000 root scale
   * threw the stone clear of its own prongs here while the source rendered it centred.
   *
   * Only the translation is dropped, never the bounding box re-centred: a pear is genuinely
   * asymmetric about its origin (z −5.98 → 2.77, origin at the round end) and centring it would
   * break it.
   */
  dropTranslation = false,
) {
  const geometries = useMemo(() => {
    const box = meshBounds(meshes);
    const size = box.getSize(new THREE.Vector3());
    const toMm = widthMm && size.x > 0 ? widthMm / size.x : 1;
    const scaleToMm = new THREE.Matrix4().makeScale(toMm, toMm, toMm);

    return meshes.map((m) => {
      const g = m.geometry.clone();
      const matrix = m.matrix;
      if (dropTranslation) {
        const stripped = matrix.clone();
        stripped.setPosition(0, 0, 0);
        g.applyMatrix4(stripped);
      } else {
        g.applyMatrix4(matrix);
      }
      g.applyMatrix4(scaleToMm);
      g.computeBoundingBox();
      return g;
    });
  }, [meshes, widthMm, dropTranslation]);

  useLayoutEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return geometries;
}

function CenterStone({
  stone,
  model,
  carat,
  baseY,
}: {
  stone: Stone;
  model: string;
  carat: number;
  /** Culet height, from the head solve — the prongs and the stone have to agree on it. */
  baseY: number;
}) {
  const meshes = useGlbMeshes(model);
  const envMap = useCubeEnv(DIAMOND_HDR, STONE_DESATURATION, STONE_FILL);

  // Baked at the stone's 1ct millimetre size, so this is stable across carat changes. The
  // node translation is dropped to match how the source reads a centre stone — see
  // useMillimetreGeometries.
  const geometries = useMillimetreGeometries(meshes, stone.dimensions.width, true);

  // All that's left for the model matrix: how much bigger this carat is than 1ct.
  const caratScale =
    stoneDimensionsAtCarat(stone, carat).width / stone.dimensions.width;

  const lift = useMemo(() => {
    const box = new THREE.Box3();
    geometries.forEach((g) => g.boundingBox && box.union(g.boundingBox));
    return -box.min.y;
  }, [geometries]);

  return (
    <group scale={caratScale} position={[0, baseY + lift * caratScale, 0]}>
      {geometries.map((g, i) => (
        <mesh key={`${model}-${i}`} geometry={g}>
          <MeshRefractionMaterial
            envMap={envMap}
            {...DIAMOND_MATERIAL}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A part with its node transform baked in, so it measures millimetres along +y. */
function useBakedParts(model: string) {
  const meshes = useGlbMeshes(model);
  const parts = useMemo(() => bakeToMillimetres(meshes), [meshes]);
  useLayoutEffect(
    () => () => parts.forEach((p) => p.geometry.dispose()),
    [parts],
  );
  return parts;
}

/**
 * Stretches `Bottom.glb` along +y to `length`, the way the configurator does it: every
 * vertex past the stalk's natural 0.55 shoulder is snapped to the new end. Normals are left
 * alone deliberately — the stalk is prismatic, so they stay correct under the stretch.
 */
function useStretchedBottom(
  parts: ReturnType<typeof useGlbMeshes>,
  length: number,
) {
  const geometries = useMemo(
    () =>
      drawable(parts).map((m) => {
        const geometry = m.geometry.clone();
        const attribute = geometry.attributes.position as THREE.BufferAttribute;
        const array = attribute.array as Float32Array;
        for (let i = 1; i < array.length; i += 3) {
          if (array[i] > 0.5) array[i] = length;
        }
        attribute.needsUpdate = true;
        geometry.computeBoundingBox();
        return geometry;
      }),
    [parts, length],
  );

  useLayoutEffect(
    () => () => geometries.forEach((g) => g.dispose()),
    [geometries],
  );
  return geometries;
}

/** Pavé melee are carried inside the `Middle{n}Pave` arms, named `diamondmesh…`. */
const isMelee = (name: string) => name.startsWith("diamondmesh");

/**
 * A single prong: a stretched `Bottom`, a whole-segment `Middle{n}`, and a tip — stacked
 * along +y, then leaned out from the ring axis.
 */
function Prong({
  solve,
  prongWidth,
  mountY,
  tipModel,
  metal,
  pave,
  wedge,
}: {
  solve: ProngSolve;
  prongWidth: number;
  mountY: number;
  tipModel: string;
  metal: THREE.Material;
  pave: boolean;
  /** Finish in a wedge rather than a claw — see HeadLayout.caged. */
  wedge: boolean;
}) {
  const bottomParts = useBakedParts(PRONG_BOTTOM);
  const middleParts = useBakedParts(middleModel(solve.segments, pave));
  // A basket or bezel already grips the girdle, so the prong ends in a flat wedge cut to its
  // own lean instead of a claw curling over a stone it no longer has to hold.
  const tipParts = useBakedParts(
    wedge ? wedgeTipModel(wedgeTipAngle(solve.tilt), pave) : tipModel,
  );
  const envMap = useCubeEnv(DIAMOND_HDR, STONE_DESATURATION, STONE_FILL);

  const bottom = useStretchedBottom(bottomParts, solve.bottomLength);
  const middleAnchor = useMemo(() => readAnchors(middleParts), [middleParts]);
  const tipAnchor = useMemo(() => readAnchors(tipParts), [tipParts]);

  // Every part carries its own join locators, so the whole alignment is just sliding each
  // one until its bottom pointer meets the top pointer of the part beneath it.
  const middleY = solve.bottomLength - middleAnchor.bottom;
  const tipY = middleY + middleAnchor.top - tipAnchor.bottom;

  // YXZ is load-bearing. The lean has to be applied *before* the azimuth: under the default
  // XYZ order the azimuth spins around +y first and leaves the lean pointing the same way in
  // world space for every prong, so they all fall toward one side instead of splaying out
  // along their own radii.
  const rotation = useMemo(
    () => new THREE.Euler(-solve.tilt, solve.azimuth, 0, "YXZ"),
    [solve.tilt, solve.azimuth],
  );

  return (
    <group position={[0, mountY, 0]} rotation={rotation} scale={prongWidth}>
      {bottom.map((geometry, i) => (
        <mesh key={`bottom-${i}`} geometry={geometry} material={metal} />
      ))}

      <group position={[0, middleY, 0]}>
        {drawable(middleParts).map((m, i) =>
          isMelee(m.name) ? (
            <mesh key={`melee-${i}`} geometry={m.geometry}>
              <MeshRefractionMaterial
                envMap={envMap}
                {...DIAMOND_MATERIAL}
                toneMapped={false}
              />
            </mesh>
          ) : (
            <mesh key={`middle-${i}`} geometry={m.geometry} material={metal} />
          ),
        )}
      </group>

      <group position={[0, tipY, 0]}>
        {drawable(tipParts).map((m, i) => (
          <mesh key={`tip-${i}`} geometry={m.geometry} material={metal} />
        ))}
      </group>
    </group>
  );
}

type ProngSolve = {
  /** Azimuth around the ring axis, radians. */
  azimuth: number;
  /** Lean away from vertical, radians. */
  tilt: number;
  /** Which `Middle{n}` this arm needs. */
  segments: number;
  /** How far `Bottom` is stretched to make up the remainder, authored units. */
  bottomLength: number;
  /**
   * Top of the prong's middle segment in authored units. `Middle{n}` runs 0.55 → 0.55 + span
   * and is offset by `bottomLength - 0.55`, so its top is simply `bottomLength + span`.
   */
  armTop: number;
};

type HeadLayout = {
  prongWidth: number;
  /** Height of the prongs' seat on the band. */
  mountY: number;
  /** Height of the stone's culet. Same calculation — the stone rides on the tallest arm. */
  stoneY: number;
  /** A basket or bezel holds the girdle, so the prongs take wedge tips instead of claws. */
  caged: boolean;
  /** The basket/halo style name the configurator branches on, or null. */
  style: string | null;
  /** Gap between the band's mounting face and the culet — the basket hangs off this. */
  clearance: number;
  /** Radial seat of each prong; the halo's curved arms land on these. */
  aSides: number[];
  prongs: ProngSolve[];
};

/**
 * Solves the head the way the configurator does.
 *
 * The thing to understand, and the thing this build previously got wrong: **prongs are not
 * stood up at the girdle radius.** Every one is seated on the ring axis at the top of the
 * band and then leaned outward until its face meets the girdle. That lean is what makes the
 * arms converge into the V beneath the stone — the defining line of a solitaire head. Put
 * them at the girdle radius instead and you get four parallel posts.
 *
 * Stone height falls out of the same solve: the culet sits one clearance above the seat,
 * plus the rise of the tallest arm.
 */
function useHeadLayout(
  stone: Stone,
  carat: number,
  angles: number[],
  countType: string,
  bandWidthMm: number,
  pave: boolean,
  basketHalo: string,
  cathedral: boolean,
): HeadLayout {
  return useMemo(() => {
    const dims = stoneDimensionsAtCarat(stone, carat);
    const prongWidth = prongWidthAtCarat(carat);
    const style = basketHaloStyle(basketHalo);

    // A basket or bezel seats the stone inside a cage, which moves both where the prong
    // meets it and how much pavilion the arm has to clear.
    const offsets = headOffsets(
      style,
      carat,
      dims.girdleThickness,
      cathedral,
    );

    // The vendor measures from the ring centre: inner radius + band thickness − seat. This
    // shank is a torus centred at −meanRadius, so that same face is just the tube radius.
    // The seat term sinks the prong's base into the metal rather than perching it on top.
    const mountY = bandWidthMm / 2 - PRONG_SEAT * prongWidth;

    const aSides = prongASides(
      stone.name,
      countType,
      angles,
      dims.length,
      dims.width,
    );
    const spans = pave ? MIDDLE_SPANS_PAVE : MIDDLE_SPANS;

    const arms = angles.map((azimuth, i) => {
      const arm = solveProngArm(
        aSides[i] + offsets.radial,
        offsets.clearance,
        prongWidth,
        dims.pavHeight - offsets.pavilion,
      );
      const parts = splitProngArm(
        arm.armLength,
        prongWidth,
        arm.angleOfApproach,
        spans,
      );
      return { azimuth, rise: arm.bSide, parts };
    });

    const tallest = arms.reduce((most, a) => Math.max(most, a.rise), 0);
    const stoneY = mountY + offsets.clearance + tallest;

    /** Span of `Middle{n}` between its own pointers, in authored units. */
    const spanOf = (n: number) => (spans[n] ?? 0) - 0.0169;

    /**
     * A halo does not re-aim the prongs.
     *
     * It is tempting to think it must — the curved `HaloArm` starts from the ring, so surely
     * the straight body below it has to be pointed at that start. It doesn't. The halo's whole
     * effect on the prong is already carried by `headOffsets("Classic")`, which pushes the
     * seat out by `prongWidth/6.6 + (0.795·ratio − 0.715·prongWidth)/2` and shortens the
     * pavilion the arm must clear by `1.1834·ratio − girdle`. The solve above consumes both,
     * so the lean it returns is the lean a halo wants — 60.2° at 1ct, which is why the head
     * then picks `WedgeTip60`.
     *
     * Re-deriving the lean from the stone's outline instead throws that away, and with it the
     * bend that makes the arms converge under the girdle.
     */
    const prongs = arms.map((a) => ({
      azimuth: a.azimuth,
      ...a.parts,
      armTop: a.parts.bottomLength + spanOf(a.parts.segments),
    }));

    return {
      prongWidth,
      mountY,
      stoneY,
      caged: isCagedStyle(style),
      // Raw, *before* `offsets.radial`. The halo's arms are placed off this table directly
      // (`prongArmASide` in the source), while the prong bodies are solved off the offset one.
      aSides,
      style,
      clearance: offsets.clearance,
      prongs,
    };
  }, [
    stone,
    carat,
    angles,
    countType,
    bandWidthMm,
    pave,
    basketHalo,
    cathedral,
  ]);
}

function Prongs({
  layout,
  color,
  tipModel,
  pave,
}: {
  layout: HeadLayout;
  color: string;
  tipModel: string;
  pave: boolean;
}) {
  const metal = useMetalMaterial(color);

  return (
    <>
      {layout.prongs.map((solve, i) => (
        <Prong
          key={i}
          solve={solve}
          prongWidth={layout.prongWidth}
          mountY={layout.mountY}
          tipModel={tipModel}
          metal={metal}
          pave={pave}
          wedge={layout.caged}
        />
      ))}
    </>
  );
}

/**
 * Extent of a baked part along one axis, in millimetres. `only` narrows it to the melee set
 * into the part, which is what a pavé run has to be spaced on: the metal segment is far wider
 * than its stone, so pitching on the segment leaves a gap beside every stone, while pitching
 * on the stone overlaps the metal into one continuous rail — which is how a real pavé line is
 * cut, and what the source shows.
 */
/** Furthest extent of a baked part along one axis, signed — for clearances. */
function partBound(
  parts: ReturnType<typeof useGlbMeshes>,
  axis: "x" | "z",
  side: "min" | "max",
) {
  let bound = side === "max" ? -Infinity : Infinity;
  drawable(parts).forEach((m) => {
    const box = m.geometry.boundingBox;
    if (!box) return;
    bound =
      side === "max" ? Math.max(bound, box.max[axis]) : Math.min(bound, box.min[axis]);
  });
  return Number.isFinite(bound) ? bound : 0;
}

function partSpan(
  parts: ReturnType<typeof useGlbMeshes>,
  axis: "x" | "z",
  only: "all" | "stones" = "all",
) {
  let span = 0;
  drawable(parts)
    .filter((m) => only === "all" || isSetStone(m.name))
    .forEach((m) => {
      const box = m.geometry.boundingBox;
      if (box) span = Math.max(span, box.max[axis] - box.min[axis]);
    });
  return span;
}

/**
 * Instances one part around a rim.
 *
 * The parts are authored with +x pointing radially outward and z running tangentially, so
 * each copy is a plain Y rotation plus a radial offset — the same placement the configurator
 * uses (`position.set(point)`, `rotation.set(0, θ, 0)`, uniform scale).
 *
 * The +π/2 is load-bearing. A prong at azimuth θ points along (−sin θ, 0, −cos θ), while a
 * part's +x under `rotation.y = φ` points along (cos φ, 0, −sin φ). Those agree only at
 * φ = θ + π/2, so without it the rim lands a quarter turn off its own prongs.
 */
function RimRing({
  model,
  pieces,
  y,
  scale,
  metal,
  envMap,
  setStones,
}: {
  model: string;
  /** Pre-solved placements: position on the outline plus its facing. */
  pieces: RimFrame[];
  y: number;
  scale: number;
  metal: THREE.Material;
  envMap: THREE.Texture;
  /** Whether the melee set into each part are kept. */
  setStones: boolean;
}) {
  const parts = useBakedParts(model);
  const meshes = useMemo(() => drawable(parts), [parts]);

  return (
    <>
      {pieces.map((piece, i) => (
        <group key={i} position={[piece.x, y, piece.z]}>
          <group rotation={[0, piece.rotY, 0]} scale={scale}>
            {meshes.map((m, j) => {
              if (isSetStone(m.name)) {
                if (!setStones) return null;
                return (
                  <mesh key={`stone-${j}`} geometry={m.geometry}>
                    <MeshRefractionMaterial
                      envMap={envMap}
                      {...DIAMOND_MATERIAL}
                      toneMapped={false}
                    />
                  </mesh>
                );
              }
              return (
                <mesh key={`metal-${j}`} geometry={m.geometry} material={metal} />
              );
            })}
          </group>
        </group>
      ))}
    </>
  );
}

/**
 * The basket — a rim of segments under the stone, one `Block` at each prong and `Plain`
 * pieces filling the arcs between. A bezel uses the same rim with the thicker 0.23 blocks
 * and no melee: the configurator's own bezel tip model is a placeholder cube, so the rim is
 * what stands in for it.
 */
function Basket({
  stone,
  carat,
  azimuths,
  prongWidth,
  stoneY,
  clearance,
  color,
  showStones,
  hidden,
}: {
  stone: Stone;
  carat: number;
  azimuths: number[];
  prongWidth: number;
  stoneY: number;
  clearance: number;
  color: string;
  /** Hidden halo and pavé basket keep the melee set into the blocks; a plain basket doesn't. */
  showStones: boolean;
  /** A hidden halo pulls the rim in to its inner edge. */
  hidden: boolean;
}) {
  const metal = useMetalMaterial(color);
  const envMap = useCubeEnv(DIAMOND_HDR, STONE_DESATURATION, STONE_FILL);
  const dims = stoneDimensionsAtCarat(stone, carat);

  // A plain basket is built from `Plain` pieces only. They carry no stone seats, which is
  // what makes the rail read as one smooth ribbon; the `Block` pieces have melee sockets cut
  // into them, so using those for a plain basket leaves the rail pocked with empty seats.
  const smooth = !showStones;
  const exponent = outlineExponent(stone.name);

  const measurements = useMemo(
    () =>
      basketMeasurements(
        stone.name,
        dims.width,
        dims.length,
        prongWidth,
        hidden,
      ),
    [stone.name, dims.width, dims.length, prongWidth, hidden],
  );

  const rail = useBasketRail(measurements, exponent, measurements.height);

  const pieces = useMemo(
    () =>
      rimLayout(
        azimuths,
        measurements.topOuterLength,
        measurements.topOuterWidth,
        exponent,
        prongWidth,
        false,
      ),
    [azimuths, measurements, exponent, prongWidth],
  );

  const y = basketHeight(stone.name, stoneY, dims.pavHeight, clearance);

  // A plain basket is the lofted rail on its own; the melee-bearing styles set their stones
  // into the scalloped block pieces instead.
  if (smooth) {
    return (
      <group position={[0, y, 0]}>
        <mesh geometry={rail} material={metal} />
      </group>
    );
  }

  // One ring per distinct part — two block thicknesses, two handed plain pieces.
  const runs = [
    {
      model: basketBlockModel(stone.name, 0.15),
      pieces: pieces.filter((p) => p.kind === "block" && p.thickness === 0.15),
      stones: showStones,
    },
    {
      model: basketBlockModel(stone.name, 0.23),
      pieces: pieces.filter((p) => p.kind === "block" && p.thickness === 0.23),
      stones: showStones,
    },
    {
      model: basketPlainModel(stone.name, "Right"),
      pieces: pieces.filter((p) => p.kind === "plain" && p.side === "Right"),
      stones: false,
    },
    {
      model: basketPlainModel(stone.name, "Left"),
      pieces: pieces.filter((p) => p.kind === "plain" && p.side === "Left"),
      stones: false,
    },
  ].filter((r) => r.pieces.length > 0);

  return (
    <>
      {runs.map((run) => (
        <RimRing
          key={run.model}
          model={run.model}
          pieces={run.pieces}
          y={y}
          scale={prongWidth}
          metal={metal}
          envMap={envMap}
          setStones={run.stones}
        />
      ))}
    </>
  );
}

/**
 * The basket's rail — a smooth band lofted around the stone's outline.
 *
 * This is generated rather than assembled, which is what the configurator does too. Its
 * `Block`/`Plain` GLBs are scalloped pavé bridges with stone seats cut into them; they load
 * on every basket because those `useLoader` hooks are unconditional (the same way `WedgeTip`
 * loads for a plain head without being drawn), but a *plain* basket draws none of them — the
 * rail it shows is a continuous loft, which is why the real one has no seams or sockets.
 *
 * `basketMeasurements` already gives the four radii this needs: the band runs outer→inner
 * across its top face and outer→inner across its bottom, and the outline exponent makes it
 * follow a squared stone instead of bulging round it.
 */
function useBasketRail(
  m: BasketMeasurements,
  exponent: number,
  height: number,
) {
  const geometry = useMemo(() => {
    const SEGMENTS = 256;
    const top = height / 2;
    const bottom = -height / 2;

    const position: number[] = [];
    const index: number[] = [];

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = (i / SEGMENTS) * Math.PI * 2;
      const dx = -Math.sin(t);
      const dz = -Math.cos(t);
      const at = (long: number, wide: number) =>
        outlineRadius(t, long, wide, exponent);

      // Cross-section, walked as a closed loop: over the top face, down the inner wall,
      // back along the bottom, up the outer wall.
      const section: [number, number][] = [
        [at(m.topOuterLength, m.topOuterWidth), top],
        [at(m.topInnerLength, m.topInnerWidth), top],
        [at(m.bottomInnerLength, m.bottomInnerWidth), bottom],
        [at(m.bottomOuterLength, m.bottomOuterWidth), bottom],
      ];
      section.forEach(([r, y]) => position.push(dx * r, y, dz * r));
    }

    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 4;
      const b = (i + 1) * 4;
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4;
        index.push(a + k, b + k, b + next, a + k, b + next, a + next);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  }, [m, exponent, height]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * A bezel — a continuous metal wall wrapping the girdle.
 *
 * This one is procedural on purpose, not for lack of a model: selecting Bezel on the source
 * pulls no cage geometry at all over the network (only `Middle2` + `WedgeTip50` for the
 * prongs), so the wall is generated there too. A lathed rectangular section revolved about
 * the ring axis gives the same closed collar, squashed to the stone's outline.
 */
function Bezel({
  stone,
  carat,
  stoneY,
  color,
}: {
  stone: Stone;
  carat: number;
  stoneY: number;
  color: string;
}) {
  const metal = useMetalMaterial(color);
  const dims = stoneDimensionsAtCarat(stone, carat);

  /**
   * Deferred for the same reason the halo's rail is: a cushion, marquise or pear collar solves
   * its outline by numerically integrating the curve, which is far too slow to run per frame
   * while the carat slider moves. See the Halo component.
   */
  const laggedCarat = useDeferredValue(carat);
  const collarDims = useMemo(
    () => stoneDimensionsAtCarat(stone, laggedCarat),
    [stone, laggedCarat],
  );
  const collarProngWidth = prongWidthAtCarat(laggedCarat);

  const geometry = useMemo(
    () =>
      bezelGeometry(stone.name, {
        width: collarDims.width,
        length: collarDims.length,
        girdleThickness: collarDims.girdleThickness,
        prongWidth: collarProngWidth,
      }),
    [stone.name, collarDims, collarProngWidth],
  );

  useLayoutEffect(() => () => geometry?.dispose(), [geometry]);

  const y = bezelHeight(
    stoneY,
    dims.pavHeight,
    dims.girdleThickness,
    collarProngWidth,
  );

  if (!geometry) return null;

  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geometry} material={metal} />
    </group>
  );
}

/** Instances one halo part at each of its solved placements. */
function HaloParts({
  model,
  placements,
  scale,
  metal,
  envMap,
}: {
  model: string;
  placements: HaloPlacement[];
  scale: number;
  metal: THREE.Material;
  envMap: THREE.Texture;
}) {
  const parts = useBakedParts(model);
  const meshes = useMemo(() => drawable(parts), [parts]);

  return (
    <>
      {placements.map((placement, i) => (
        <group key={i} position={placement.position}>
          <group rotation={[0, placement.rotY, 0]} scale={scale}>
            {meshes.map((m, j) =>
              isSetStone(m.name) ? (
                <mesh key={`stone-${j}`} geometry={m.geometry}>
                  <MeshRefractionMaterial
                    envMap={envMap}
                    {...DIAMOND_MATERIAL}
                    toneMapped={false}
                  />
                </mesh>
              ) : (
                <mesh key={`metal-${j}`} geometry={m.geometry} material={metal} />
              ),
            )}
          </group>
        </group>
      ))}
    </>
  );
}

/**
 * A halo — a rail of melee around the girdle, carried on curved arms that rise from the band.
 *
 * The rail's layout is per-outline and comes from `lib/settings/haloLayout`; see that module
 * for why it cannot be one parametric ring. Shapes not yet ported there fall back to the old
 * superellipse below, which places no corner piece and no bed.
 */
function Halo({
  stone,
  carat,
  prongWidth,
  ratio,
  stoneY,
  color,
  hidden,
  azimuths,
  aSides,
  tipId,
}: {
  stone: Stone;
  carat: number;
  prongWidth: number;
  /** `haloThicknessRatio` — what every halo part scales by, prong width being capped. */
  ratio: number;
  stoneY: number;
  color: string;
  hidden: boolean;
  /** Prong azimuths, and the raw per-shape aSide table the arms are placed off. */
  azimuths: number[];
  aSides: number[];
  tipId: string;
}) {
  const metal = useMetalMaterial(color);
  const envMap = useCubeEnv(DIAMOND_HDR, STONE_DESATURATION, STONE_FILL);
  const dims = stoneDimensionsAtCarat(stone, carat);

  const armParts = useBakedParts(haloArmModel(stone.name));
  const haloTipParts = useBakedParts(haloTipModel(stone.name, tipId));

  /**
   * The rail lags the carat slider by a frame or two.
   *
   * Cushion, marquise and pear solve their spacing by numerically integrating the outline and
   * hunting for each seat along it — about 200ms of arithmetic. That is the source's algorithm
   * and its sample count is load-bearing, so it cannot be cheapened without moving the seats.
   * Deferring it instead lets React collapse a drag into one solve at the end: the stone and
   * prongs track the slider live, and the rail resizes a beat later.
   */
  const laggedCarat = useDeferredValue(carat);
  const railRatio = haloThicknessRatio(laggedCarat);
  const railDims = useMemo(
    () => stoneDimensionsAtCarat(stone, laggedCarat),
    [stone, laggedCarat],
  );

  const layout = useMemo(
    () =>
      haloLayout(stone.name, {
        width: railDims.width,
        length: railDims.length,
        carat: laggedCarat,
        ratio: railRatio,
      }),
    [stone.name, railDims.width, railDims.length, laggedCarat, railRatio],
  );

  // The beds are generated, so this component owns them.
  useLayoutEffect(
    () => () => layout?.beds.forEach((bed) => bed.geometry.dispose()),
    [layout],
  );

  /** One `HaloParts` per distinct GLB, so each calls `useBakedParts` exactly once. */
  const partGroups = useMemo(() => {
    if (!layout) return [];
    const groups = new Map<string, HaloPlacement[]>();
    for (const placement of layout.placements) {
      const model = haloPartModel(stone.name, placement.part);
      const group = groups.get(model);
      if (group) group.push(placement);
      else groups.set(model, [placement]);
    }
    return [...groups].map(([model, placements]) => ({ model, placements }));
  }, [layout, stone.name]);

  const y = hidden
    ? haloHeight(stoneY, dims.pavHeight, dims.girdleThickness, ratio) -
      dims.girdleThickness -
      rimThickness(ratio)
    : haloHeight(stoneY, dims.pavHeight, dims.girdleThickness, ratio);

  /**
   * The curved arms, placed as the configurator places them: out at `aSide + 0.795·ratio/2`
   * along each prong's own bearing, `rotation.y = θ` with no quarter-turn, uniformly scaled by
   * the thickness ratio — and inside the halo's group rather than on the prong stack, which is
   * what makes them read as the prongs bending over to cradle the rail.
   *
   * `0.795·ratio` is the rim thickness, so the arm rides the rail's own centre line. The plain
   * azimuth is the tell that halo parts are authored +z radial, unlike the basket's +x.
   * `HaloArm` runs y −0.274→1.243 flaring to z 1.044, and every halo tip picks up at exactly
   * 1.243, so arm and tip share one offset and need no locators.
   */
  const arms = useMemo(() => {
    const reach = rimThickness(ratio);
    return azimuths.map((azimuth, i) => {
      const radius = (aSides[i] ?? 0) + reach / 2;
      return {
        x: -radius * Math.sin(azimuth),
        z: -radius * Math.cos(azimuth),
        rotY: azimuth,
      };
    });
  }, [azimuths, aSides, ratio]);

  return (
    <group position={[0, y, 0]}>
      {layout ? (
        <>
          {layout.beds.map((bed, i) => (
            <mesh
              key={`bed-${i}`}
              geometry={bed.geometry}
              material={metal}
              position={bed.position}
              rotation={new THREE.Euler(...bed.rotation, "YXZ")}
            />
          ))}
          {partGroups.map(({ model, placements }) => (
            <HaloParts
              key={model}
              model={model}
              placements={placements}
              // Scaled to match the seats the layout solved, not the live carat, so a lagging
              // rail stays internally consistent while it catches up.
              scale={railRatio}
              metal={metal}
              envMap={envMap}
            />
          ))}
        </>
      ) : (
        <LegacyHaloRing
          stone={stone}
          dims={dims}
          prongWidth={prongWidth}
          armParts={armParts}
          metal={metal}
          envMap={envMap}
        />
      )}

      {arms.map((arm, i) => (
        <group key={i} position={[arm.x, 0, arm.z]}>
          <group rotation={[0, arm.rotY, 0]} scale={ratio}>
            {drawable(armParts).map((m, j) => (
              <mesh key={`arm-${j}`} geometry={m.geometry} material={metal} />
            ))}
            {drawable(haloTipParts).map((m, j) => (
              <mesh key={`tip-${j}`} geometry={m.geometry} material={metal} />
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * The old parametric ring, kept only for the outlines whose real layout isn't ported yet.
 *
 * It wraps one superellipse around every shape and never places a corner piece, so on anything
 * with corners the blocks splay across the turn instead of mitring into it. Delete a case from
 * `haloLayout`'s fallback and this stops being reachable for that shape.
 */
function LegacyHaloRing({
  stone,
  dims,
  prongWidth,
  armParts,
  metal,
  envMap,
}: {
  stone: Stone;
  dims: ReturnType<typeof stoneDimensionsAtCarat>;
  prongWidth: number;
  armParts: ReturnType<typeof useBakedParts>;
  metal: THREE.Material;
  envMap: THREE.Texture;
}) {
  const model = haloEdgeModel(stone.name);
  const parts = useBakedParts(model);

  const pieces = useMemo(() => {
    const radial = partSpan(parts, "x") * prongWidth;
    const pitch = partSpan(parts, "z", "stones") * prongWidth;
    const clearance = partBound(armParts, "z", "max") * prongWidth;
    const atZero = dims.length / 2 + clearance + radial / 2;
    const atQuarter = dims.width / 2 + clearance + radial / 2;
    const exponent = outlineExponent(stone.name);
    const count = Math.max(
      8,
      Math.round(outlinePerimeter(atZero, atQuarter, exponent) / pitch),
    );
    return ringFrames(count, atZero, atQuarter, exponent, "x");
  }, [parts, armParts, prongWidth, dims.length, dims.width, stone.name]);

  return (
    <RimRing
      model={model}
      pieces={pieces}
      y={0}
      scale={prongWidth}
      metal={metal}
      envMap={envMap}
      setStones
    />
  );
}

function Shank({
  color,
  ringSize,
  bandWidthMm,
}: {
  color: string;
  ringSize: number;
  bandWidthMm: number;
}) {
  const metal = useMetalMaterial(color);
  const tube = bandWidthMm / 2;
  const meanRadius = innerDiameterMm(ringSize) / 2 + tube;

  return (
    <mesh material={metal} position={[0, -meanRadius, 0]}>
      <torusGeometry args={[meanRadius, tube, 32, 160]} />
    </mesh>
  );
}

export default function RingScene({
  stone,
  stoneModel,
  carat,
  metalColor,
  ringSize = 6.5,
  bandWidthMm = 1.8,
  prongAngles = [],
  prongCountType = "4 Classic",
  prongTipModel = "/models/ClawTip.glb",
  prongTipId = "Claw",
  prongMetalColor,
  prongPave = false,
  basketHalo = "None",
  cathedral = false,
}: SceneProps) {
  const head = useHeadLayout(
    stone,
    carat,
    prongAngles,
    prongCountType,
    bandWidthMm,
    prongPave,
    basketHalo,
    cathedral,
  );

  // The ring stands ~20mm tall with the stone on top; this framing keeps both in view.
  // The canvas is transparent so the studio backdrop behind it shows through, matching
  // the original's `.wrapper` CSS background.
  return (
    <Canvas
      camera={{ fov: 30, position: [0, 2, 52], near: 0.5, far: 500 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[20, 30, 25]} intensity={1.2} />
      <directionalLight position={[-20, 10, -15]} intensity={0.5} />

      <Suspense fallback={null}>
        <group position={[0, 5, 0]}>
          <Shank color={metalColor} ringSize={ringSize} bandWidthMm={bandWidthMm} />
          <CenterStone
            stone={stone}
            model={stoneModel}
            carat={carat}
            baseY={head.stoneY}
          />
          <Prongs
            layout={head}
            color={prongMetalColor ?? metalColor}
            tipModel={prongTipModel}
            pave={prongPave}
          />

          {/*
            Routing verified against the source's network traffic: Basket and Hidden Halo
            load the identical three basket-rim GLBs and differ only in whether the melee
            stay; Halo loads its own arm and edge blocks; Bezel loads no cage geometry.
          */}
          {usesBasketRim(head.style) && (
            <Basket
              stone={stone}
              carat={carat}
              azimuths={prongAngles}
              prongWidth={head.prongWidth}
              stoneY={head.stoneY}
              clearance={head.clearance}
              color={prongMetalColor ?? metalColor}
              showStones={rimShowsStones(head.style)}
              hidden={head.style === "Hidden"}
            />
          )}

          {head.style === "Classic" && (
            <Halo
              stone={stone}
              carat={carat}
              prongWidth={head.prongWidth}
              ratio={haloThicknessRatio(carat)}
              stoneY={head.stoneY}
              color={prongMetalColor ?? metalColor}
              hidden={false}
              azimuths={prongAngles}
              aSides={head.aSides}
              tipId={prongTipId}
            />
          )}

          {head.style === "Bezel" && (
            <Bezel
              stone={stone}
              carat={carat}
              stoneY={head.stoneY}
              color={prongMetalColor ?? metalColor}
            />
          )}
        </group>
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, 2, 0]}
        minDistance={20}
        maxDistance={120}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
      />
    </Canvas>
  );
}
