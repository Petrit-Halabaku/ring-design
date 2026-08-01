/**
 * The generated metal a halo's melee are set into.
 *
 * None of this comes from a GLB. The source builds each bed at runtime from the stone's own
 * dimensions, because the rail has to follow whatever outline the halo is wrapping — an
 * authored part could only ever fit one size of one shape.
 */
import * as THREE from "three";
import type { PlanePoint } from "./outline";
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

/**
 * Stitches a bed out of an inner ring, an outer ring, and a swept surface joining them.
 *
 * The two rings are bridged by a flat band; the swept rows then hang the rounded outer wall
 * below it. `rings` is how many points each ring carries, `columns` how many rows the sweep is
 * sampled at — both fixed per shape by the source.
 */
function stitch(
  positions: number[],
  rings: number,
  columns: number,
): THREE.BufferGeometry {
  const index: number[] = [];

  for (let i = 0; i < rings; i++) {
    const next = (i + 1) % rings;
    index.push(i, next, i + rings);
    index.push(next + rings, i + rings, next);
  }

  const sweepStart = 2 * rings;
  const vertices = positions.length / 3;
  for (let row = 0; row < rings; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const a = sweepStart + row * columns + col;
      const b = a + 1;
      const c = a + columns;
      const d = b + columns;
      if (a >= vertices || b >= vertices || c >= vertices || d >= vertices) continue;
      index.push(a, b, c);
      index.push(b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Inward unit normal of the ellipse with semi-axes `b` (x) and `a` (z), at a point on it. */
function ellipseNormal(x: number, z: number, b: number, a: number) {
  const nx = -x / (b * b);
  const nz = -z / (a * a);
  const length = Math.sqrt(nx * nx + nz * nz);
  return { nx: nx / length, nz: nz / length };
}

/**
 * The oval's bed: two concentric ellipses with a tube swept along the line between them.
 *
 * Unlike the blended shapes below, the sweep here rides the ellipse's own normal, so the outer
 * wall stays perpendicular to the rail all the way round.
 */
export function ovalBed(
  innerX: number,
  innerZ: number,
  outerX: number,
  outerZ: number,
  rim: number,
  segments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];

  for (const [rx, rz] of [
    [innerX, innerZ],
    [outerX, outerZ],
  ]) {
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * 2 * Math.PI;
      positions.push(rx * Math.cos(t), 0, rz * Math.sin(t));
    }
  }

  for (let i = 0; i < segments + 1; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const midX = (outerX * Math.cos(t) + innerX * Math.cos(t)) / 2;
    const midZ = (outerZ * Math.sin(t) + innerZ * Math.sin(t)) / 2;
    const { nx, nz } = ellipseNormal(
      midX,
      midZ,
      (outerX + innerX) / 2,
      (outerZ + innerZ) / 2,
    );
    for (let k = 0; k < segments; k++) {
      const sweep = (Math.PI / (segments - 1)) * k;
      positions.push(
        midX + (rim / 2) * nx * Math.cos(sweep),
        -(rim / 2) * Math.sin(sweep),
        midZ + (rim / 2) * nz * Math.cos(sweep),
      );
    }
  }

  return stitch(positions, segments, segments);
}

/**
 * The bed for a blended outline — cushion, marquise, pear.
 *
 * These cannot use the oval's normal-swept tube: their outlines are not ellipses, so there is
 * no closed-form normal. The source instead walks straight from each inner point to its outer
 * counterpart and drops the height by a half sine, which rounds the wall over without needing
 * to know which way the surface faces.
 */
export function blendedBed(
  inner: PlanePoint[],
  outer: PlanePoint[],
  rim: number,
  columns: number,
): THREE.BufferGeometry {
  const rings = inner.length;
  const positions: number[] = [];
  for (const p of inner) positions.push(p.x, 0, p.z);
  for (const p of outer) positions.push(p.x, 0, p.z);

  // One row per ring point, plus a final row that wraps back onto the first.
  for (let i = 0; i <= rings; i++) {
    const from = inner[i % rings];
    const to = outer[i % rings];
    for (let k = 0; k < columns; k++) {
      const sweep = (Math.PI / (columns - 1)) * k;
      const t = k / (columns - 1);
      positions.push(
        from.x + t * (to.x - from.x),
        -(rim / 2) * Math.sin(sweep),
        from.z + t * (to.z - from.z),
      );
    }
  }

  return stitch(positions, rings, columns);
}
