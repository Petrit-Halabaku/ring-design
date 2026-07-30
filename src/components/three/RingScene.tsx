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
import { drawable, PRONG_ARMS, readAnchors } from "./prongParts";
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

const PAVE_MODEL = "/models/DiamondPave.glb";

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
  /** Local path to the selected prong tip's GLB. */
  prongTipModel?: string;
  /** Prongs can take a different metal from the band (the configurator's "Mixed"). */
  prongMetalColor?: string;
  prongPave?: boolean;
  /** Local path to the prong arm's GLB. */
  prongArmModel?: string;
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
) {
  const geometries = useMemo(() => {
    const box = meshBounds(meshes);
    const size = box.getSize(new THREE.Vector3());
    const toMm = widthMm && size.x > 0 ? widthMm / size.x : 1;
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
  const envMap = useCubeEnv(DIAMOND_HDR, STONE_DESATURATION, STONE_FILL);

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
 * Pavé on the prong.
 *
 * The vendor sets these into the prong *arm* and boolean-subtracts the seats with
 * `BottomPaveManufacturingCSG.glb`. That arm model (`StraightRoundArm.glb`) is the one
 * asset of theirs that isn't publicly readable — both buckets return 403 — so the arm
 * itself isn't reproduced and these melee are laid down the prong's outer face instead of
 * being seated in it. The stones themselves are their real `DiamondPave.glb`.
 */
function ProngPave({
  stone,
  carat,
  color,
}: {
  stone: Stone;
  carat: number;
  color: string;
}) {
  const meshes = useGlbMeshes(PAVE_MODEL);
  const envMap = useCubeEnv(DIAMOND_HDR, STONE_DESATURATION, STONE_FILL);
  const dims = stoneDimensionsAtCarat(stone, carat);
  void color;

  // Melee are the worst case for the object-space epsilons described on
  // useMillimetreGeometries: raw, this model is 0.008 units across, so drei's 0.01
  // inter-bounce offset is nearly twice the stone's own depth and no ray survives a
  // single bounce. Baking the node transform puts object space in millimetres.
  const geometries = useMillimetreGeometries(meshes);

  // The melee are cut at a fixed size; three of them run down the prong below the girdle.
  const radius = dims.width / 2;
  const seats = [-0.55, -0.95, -1.35];

  return (
    <>
      {seats.map((y, i) => (
        <group key={i} position={[0, y, radius - 0.18]} scale={0.62}>
          {geometries.map((g, j) => (
            <mesh key={`pave-${j}`} geometry={g}>
              <MeshRefractionMaterial
                envMap={envMap}
                {...DIAMOND_MATERIAL}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * The prong head, assembled the way the configurator builds it.
 *
 * A prong is an arm plus a tip. Both are authored in a shared space where y runs up the
 * prong, z runs radially outward and x is the prong's width, and both carry `*Pointer*`
 * locators marking where they join. So the arm is stretched until its top pointer sits on
 * the stone's girdle, the tip is slid up to meet it, and the pair is swung out to the
 * girdle radius and repeated at each azimuth from the vendor's per-shape angle table.
 */
function Prongs({
  stone,
  carat,
  color,
  angles,
  tipModel,
  armModel,
  pave,
}: {
  stone: Stone;
  carat: number;
  color: string;
  angles: number[];
  tipModel: string;
  armModel: string;
  pave: boolean;
}) {
  const tipParts = useGlbMeshes(tipModel);
  const armParts = useGlbMeshes(armModel);
  const metal = useMetalMaterial(color);
  const dims = stoneDimensionsAtCarat(stone, carat);

  const tipMeshes = useMemo(() => drawable(tipParts), [tipParts]);
  const armMeshes = useMemo(() => drawable(armParts), [armParts]);
  const tipAnchor = useMemo(() => readAnchors(tipParts), [tipParts]);
  const armAnchor = useMemo(() => readAnchors(armParts), [armParts]);

  const widthScale = dims.width / stone.dimensions.width;

  // The arm has to reach from the base of the head up to the girdle. Stretching it along
  // its own axis is what the vendor's arm calculation does — a taller stone gets a taller
  // prong, not a bigger one.
  const armSpan = armAnchor.top - armAnchor.bottom;
  const armStretch = armSpan > 0 ? dims.pavHeight / armSpan : 1;
  // Where the arm's top pointer ends up once stretched, and therefore where the tip goes.
  const jointY = (armAnchor.top - armAnchor.bottom) * armStretch;

  /**
   * The stone's outline radius at a given azimuth, treating it as an ellipse with the
   * length along +Z (θ=0, where the parts are authored) and the width across +X. A round
   * gives back width/2 at every angle; an oval or marquise pushes the end prongs out to the
   * point, which is what keeps them on the girdle instead of floating over the table.
   */
  function outlineRadius(theta: number) {
    const a = dims.length / 2;
    const b = dims.width / 2;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    return (a * b) / Math.sqrt((b * c) ** 2 + (a * s) ** 2);
  }

  return (
    <>
      {angles.map((angle, i) => {
        // Sit the prong's own axis on the girdle, allowing for where its locator sits.
        const radial = outlineRadius(angle) - tipAnchor.radial * widthScale;
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <group position={[0, 0, radial]} scale={[widthScale, 1, widthScale]}>
              {/* Arm: stretched vertically so its top lands on the girdle. */}
              <group
                position={[0, -armAnchor.bottom * armStretch, 0]}
                scale={[1, armStretch, 1]}
              >
                {armMeshes.map((m, j) => (
                  <mesh
                    key={`arm-${m.name}-${j}`}
                    geometry={m.geometry}
                    material={metal}
                    matrixAutoUpdate={false}
                    matrix={m.matrix}
                  />
                ))}
              </group>

              {/* Tip: slid up so its own pointer meets the arm's. */}
              <group position={[0, jointY - tipAnchor.bottom, 0]}>
                {tipMeshes.map((m, j) => (
                  <mesh
                    key={`tip-${m.name}-${j}`}
                    geometry={m.geometry}
                    material={metal}
                    matrixAutoUpdate={false}
                    matrix={m.matrix}
                  />
                ))}
              </group>

              {pave && <ProngPave stone={stone} carat={carat} color={color} />}
            </group>
          </group>
        );
      })}
    </>
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
  prongTipModel = "/models/ClawTip.glb",
  prongMetalColor,
  prongPave = false,
  prongArmModel = PRONG_ARMS.middle4,
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
            color={prongMetalColor ?? metalColor}
            angles={prongAngles}
            tipModel={prongTipModel}
            armModel={prongArmModel}
            pave={prongPave}
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
