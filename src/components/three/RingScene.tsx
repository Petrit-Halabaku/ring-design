"use client";

import { Suspense, useLayoutEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  MeshRefractionMaterial,
  OrbitControls,
  useEnvironment,
} from "@react-three/drei";
import * as THREE from "three";
import { useGlbMeshes } from "./useGlbMeshes";
import { stoneDimensionsAtCarat } from "@/lib/settings/geometry";
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

const CLAW_TIP_MODEL = "/models/ClawTip.glb";

/**
 * The vendor's MeshRefractionMaterial settings. Everything is theirs verbatim except the
 * exposure: they use an over-white 1.85, which lands pale on their equirect sampling path
 * but reads dark through the cube projection this build has to use (see useCubeEnv). 3.1
 * matches their on-screen result.
 */
const DIAMOND_MATERIAL = {
  bounces: 3,
  aberrationStrength: 0.01,
  ior: 2.75,
  fresnel: 1,
  color: new THREE.Color(3.1, 3.1, 3.1),
  fastChroma: true,
} as const;

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
  prongCount?: number;
};

function useMetalMaterial(color: string) {
  const env = useEnvironment({ files: METAL_HDR });
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      metalness: 1,
      roughness: 0.15,
      envMapIntensity: 1.5,
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
function useCubeEnv(file: string) {
  const equirect = useEnvironment({ files: file });
  const gl = useThree((s) => s.gl);

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
    target.fromEquirectangularTexture(gl, equirect);
    return target.texture;
  }, [gl, equirect]);
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
 * own origin, and all three bounces are consumed without ever entering the stone. Every
 * pixel then samples nearly the same environment direction and the stone renders as flat
 * milky white. Round/Oval/Princess/Pear/Marquise/Asscher all break at 1.00ct, Cushion at
 * 1.15, Radiant at 1.21; Emerald is authored in millimetres and never breaks.
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
function useMillimetreGeometries(meshes: ReturnType<typeof useGlbMeshes>, widthMm: number) {
  const geometries = useMemo(() => {
    const box = meshBounds(meshes);
    const size = box.getSize(new THREE.Vector3());
    const toMm = size.x > 0 ? widthMm / size.x : 1;
    const scaleToMm = new THREE.Matrix4().makeScale(toMm, toMm, toMm);

    return meshes.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrix);
      g.applyMatrix4(scaleToMm);
      g.computeBoundingBox();
      return g;
    });
  }, [meshes, widthMm]);

  useLayoutEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return geometries;
}

function CenterStone({ stone, model, carat }: { stone: Stone; model: string; carat: number }) {
  const meshes = useGlbMeshes(model);
  const envMap = useCubeEnv(DIAMOND_HDR);

  // Baked at the stone's 1ct millimetre size, so this is stable across carat changes.
  const geometries = useMillimetreGeometries(meshes, stone.dimensions.width);

  // All that's left for the model matrix: how much bigger this carat is than 1ct.
  const caratScale =
    stoneDimensionsAtCarat(stone, carat).width / stone.dimensions.width;

  const lift = useMemo(() => {
    const box = new THREE.Box3();
    geometries.forEach((g) => g.boundingBox && box.union(g.boundingBox));
    return -box.min.y;
  }, [geometries]);

  return (
    <group scale={caratScale} position={[0, lift * caratScale, 0]}>
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

/**
 * ClawTip.glb is a single prong authored on the girdle of a 1ct round. The configurator
 * instances it around the stone; this moves each copy out to the current stone's radius.
 */
function Prongs({
  stone,
  carat,
  color,
  count,
}: {
  stone: Stone;
  carat: number;
  color: string;
  count: number;
}) {
  const meshes = useGlbMeshes(CLAW_TIP_MODEL);
  const metal = useMetalMaterial(color);
  const dims = stoneDimensionsAtCarat(stone, carat);

  // The tip is already authored in place for a 1ct round with the culet at the origin —
  // its node transform puts it on the girdle at the right radius. So the copies only need
  // rotating around the stone's axis, and scaling about that same origin as the stone grows.
  const tipScale = dims.width / stone.dimensions.width;

  return (
    <group scale={tipScale}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / count, 0]}>
          {meshes.map((m, j) => (
            <mesh
              key={`${m.name}-${j}`}
              geometry={m.geometry}
              material={metal}
              matrixAutoUpdate={false}
              matrix={m.matrix}
            />
          ))}
        </group>
      ))}
    </group>
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
  prongCount = 4,
}: SceneProps) {
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
          <CenterStone stone={stone} model={stoneModel} carat={carat} />
          <Prongs
            stone={stone}
            carat={carat}
            color={metalColor}
            count={prongCount}
          />
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
