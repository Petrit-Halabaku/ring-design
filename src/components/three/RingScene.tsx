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
 * Rebuild of the configurator's render pipeline.
 *
 * The original is react-three-fiber + drei: metal is MeshPhysicalMaterial lit by
 * `env_metal_flat.hdr`, and every diamond uses drei's MeshRefractionMaterial against
 * `diamond (1).hdr`. Both HDRs and the GLBs are the vendor's own assets, served from /public.
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

/** Kept for reference: the vendor lights stones with this one. */
export const DIAMOND_HDR = "/hdr/diamond1.hdr";
const METAL_HDR = "/hdr/env_metal_flat.hdr";

const CLAW_TIP_MODEL = "/models/ClawTip.glb";

/**
 * The vendor ships `diamond (1).hdr` for stones, but on its own it is a dark, blue-cast
 * probe — the stone comes out navy, where their live render is neutral white. Their scene
 * composites it against a bright studio backdrop we don't have, so the stone is lit with
 * their neutral `env_metal_flat.hdr` instead and the exposure lifted slightly.
 */
const STONE_HDR = METAL_HDR;
const DIAMOND_EXPOSURE = new THREE.Color(1.15, 1.15, 1.15);

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
 * drei's MeshRefractionMaterial ray-marches a cube map, so the equirectangular HDR has to
 * be projected onto one first — handing it the flat texture samples the wrong direction
 * and the stone comes out dark.
 */
function useCubeEnv(file: string) {
  const equirect = useEnvironment({ files: file });
  const gl = useThree((s) => s.gl);

  return useMemo(() => {
    const target = new THREE.WebGLCubeRenderTarget(512);
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

function CenterStone({ stone, model, carat }: { stone: Stone; model: string; carat: number }) {
  const meshes = useGlbMeshes(model);
  const env = useCubeEnv(STONE_HDR);
  const dims = stoneDimensionsAtCarat(stone, carat);

  // Rather than trusting each GLB's unit convention (the diamonds are authored at
  // 1 unit = 100mm, the metal parts at 1 unit = 1mm), measure the model and scale it
  // to the millimetre width the API reports for this stone at this carat.
  const { scale, lift } = useMemo(() => {
    const box = meshBounds(meshes);
    const size = box.getSize(new THREE.Vector3());
    const s = size.x > 0 ? dims.width / size.x : 1;
    return { scale: s, lift: -box.min.y * s };
  }, [meshes, dims.width]);

  return (
    <group scale={scale} position={[0, lift, 0]}>
      {meshes.map((m, i) => (
        <mesh
          key={`${m.name}-${i}`}
          geometry={m.geometry}
          matrixAutoUpdate={false}
          matrix={m.matrix}
        >
          <MeshRefractionMaterial
            envMap={env}
            bounces={4}
            ior={2.4}
            fresnel={0.15}
            aberrationStrength={0.015}
            color={DIAMOND_EXPOSURE}
            fastChroma
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
  // Frame on the stone: the whole ring is ~20mm tall, the stone sits at the top.
  return (
    <Canvas
      camera={{ fov: 30, position: [0, 2, 52], near: 0.5, far: 500 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#ececeb"]} />
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
