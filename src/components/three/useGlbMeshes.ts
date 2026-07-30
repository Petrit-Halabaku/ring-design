import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";

export type GlbMesh = {
  name: string;
  geometry: THREE.BufferGeometry;
  /** World matrix baked from the GLB's node hierarchy (root scale, rotations). */
  matrix: THREE.Matrix4;
  materialName: string;
};

/**
 * Flattens a GLB into meshes with their world transforms resolved.
 *
 * The configurator's models nest real transforms on their nodes — a `root` node
 * scaled 100×, per-mesh quaternions — so meshes have to carry their baked world
 * matrix rather than be dropped into the scene raw.
 */
export function useGlbMeshes(url: string): GlbMesh[] {
  const { scene } = useGLTF(url);

  return useMemo(() => {
    const out: GlbMesh[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      const attrs = mesh.geometry?.attributes;
      if (!attrs?.position || !attrs?.normal) return;

      // Some parts (ClawTip.glb) carry morph targets. Rendering their geometry on a plain
      // <mesh> leaves `morphTargetInfluences` undefined, which three dereferences on every
      // frame while building the shader program. Nothing here animates morphs, so drop them.
      let geometry = mesh.geometry;
      if (Object.keys(geometry.morphAttributes ?? {}).length > 0) {
        geometry = geometry.clone();
        geometry.morphAttributes = {};
        geometry.morphTargetsRelative = false;
      }

      const material = mesh.material as THREE.Material | THREE.Material[];
      out.push({
        name: mesh.name,
        geometry,
        matrix: mesh.matrixWorld.clone(),
        materialName: Array.isArray(material)
          ? (material[0]?.name ?? "")
          : (material?.name ?? ""),
      });
    });
    return out;
  }, [scene]);
}
