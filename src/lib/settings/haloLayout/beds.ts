/**
 * The generated metal a halo's melee are set into.
 *
 * None of this comes from a GLB. The source builds each bed at runtime from the stone's own
 * dimensions, because the rail has to follow whatever outline the halo is wrapping — an
 * authored part could only ever fit one size of one shape.
 */
import * as THREE from "three";
import { BED_CLIP_Z } from "./types";

/**
 * Drops every triangle whose three vertices all sit below `minZ` in local z.
 *
 * Vertices are left in place and only the index is rewritten, exactly as the source does it —
 * so the surviving triangles keep the normals the generator gave them.
 */
function clipBelow(
  geometry: THREE.BufferGeometry,
  minZ = BED_CLIP_Z,
): THREE.BufferGeometry {
  const index = geometry.getIndex();
  if (!index) return geometry;

  const position = geometry.attributes.position.array;
  const kept: number[] = [];

  for (let i = 0; i < index.count; i += 3) {
    const a = index.array[i];
    const b = index.array[i + 1];
    const c = index.array[i + 2];
    const below =
      position[3 * a + 2] < minZ &&
      position[3 * b + 2] < minZ &&
      position[3 * c + 2] < minZ;
    if (!below) kept.push(a, b, c);
  }

  geometry.setIndex(kept);
  return geometry;
}

/**
 * A flat ring in the xz plane — the floor the melee stand on, spanning the gap between the
 * stone's girdle and the outside of the rim.
 */
export function annulusRing(
  outerRadius: number,
  innerRadius: number,
  segments: number,
): THREE.BufferGeometry {
  const points: number[] = [];

  // Outer ring first, then inner: the index below relies on that order.
  for (const radius of [outerRadius, innerRadius]) {
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * 2 * Math.PI;
      points.push(radius * Math.cos(t), 0, radius * Math.sin(t));
    }
  }

  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    index.push(i, i + segments, next);
    index.push(next, i + segments, next + segments);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The rounded outer lip of a circular rim: a torus with its underside clipped away, so what
 * survives is the bead of metal the melee are set along.
 */
export function clippedTorus(
  radius: number,
  tube: number,
  radialSegments: number,
  tubularSegments: number,
): THREE.BufferGeometry {
  return clipBelow(
    new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
  );
}

/** The same bead run straight instead of round — one side of a squared outline. */
export function clippedCylinder(
  radius: number,
  height: number,
  radialSegments: number,
): THREE.BufferGeometry {
  return clipBelow(
    new THREE.CylinderGeometry(radius, radius, height, radialSegments),
  );
}
