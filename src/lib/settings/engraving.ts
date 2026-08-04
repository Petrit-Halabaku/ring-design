/**
 * Laser engraving on the inside of the band.
 *
 * Ported from the configurator's own engraving pass. Each character is extruded separately,
 * centred on its own width, then laid around the band's inner face at a constant gap — so the
 * spacing follows the arc rather than a straight baseline, and long messages wrap round the
 * finger instead of stretching.
 *
 * Every number here is the source's: 0.7mm glyphs cut 0.1mm deep with a 0.03/0.02 bevel, a
 * 0.3mm space character, and 0.05mm between letters.
 */
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

export const ENGRAVING_FONTS = {
  Block: "/fonts/helvetiker_regular.typeface.json",
  Cursive: "/fonts/stylescript_regular.typeface.json",
} as const;

export type EngravingFont = keyof typeof ENGRAVING_FONTS;

/** The configurator caps the message at fourteen characters. */
export const ENGRAVING_MAX = 14;

const SIZE = 0.7;
/** How deep the glyphs stand off the inner face. */
const DEPTH = 0.1;
/** Width a space advances by. */
const SPACE = 0.3;
/** Gap between adjacent glyphs. */
const GAP = 0.05;

export type EngravedGlyph = {
  geometry: THREE.BufferGeometry;
  /** Where the glyph sits and how it is turned, already resolved into a matrix. */
  matrix: THREE.Matrix4;
};

/**
 * Builds the glyphs for a message.
 *
 * `innerRadius` is the band's inner face; the glyphs ride half their depth outside it so they
 * bed into the metal rather than floating in the bore. Returned in the band's own local frame —
 * ring centred on the origin, lying in xy, width along z — so they inherit the shank's placement.
 *
 * The run is centred on the bottom of the ring, opposite the stone, which is where a ring is
 * engraved and where the text reads upright when you look inside it.
 */
export function buildEngraving(
  text: string,
  font: Font,
  innerRadius: number,
): EngravedGlyph[] {
  const message = text.slice(0, ENGRAVING_MAX);
  if (!message.trim()) return [];

  const radius = innerRadius + DEPTH / 2;

  // Extrude each character and centre it on its own width.
  const cut: { geometry: THREE.BufferGeometry | null; width: number }[] = [];
  let total = 0;
  let top = -Infinity;
  let bottom = Infinity;

  for (const character of message) {
    if (character === " ") {
      cut.push({ geometry: null, width: SPACE });
      total += SPACE;
      continue;
    }

    const geometry = new TextGeometry(character, {
      font,
      size: SIZE,
      depth: DEPTH,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3,
      bevelOffset: 0,
    });
    geometry.computeBoundingBox();

    const box = geometry.boundingBox;
    if (!box) {
      geometry.dispose();
      cut.push({ geometry: null, width: SPACE });
      total += SPACE;
      continue;
    }

    geometry.translate(-(box.max.x + box.min.x) / 2, 0, 0);
    geometry.computeBoundingBox();

    const width = box.max.x - box.min.x;
    total += width;
    top = Math.max(top, box.max.y);
    bottom = Math.min(bottom, box.min.y);
    cut.push({ geometry, width });
  }

  const drawn = cut.filter((c) => c.geometry);
  if (drawn.length === 0) return [];

  /** Vertical centre of the run, so the text sits on the band's centreline. */
  const middle = (top + bottom) / 2;

  // Total angle the run subtends, centred on the bottom of the ring.
  const span = (total + GAP * (cut.length - 1)) / radius;
  let cursor = -Math.PI / 2 - span / 2;

  const glyphs: EngravedGlyph[] = [];
  for (const { geometry, width } of cut) {
    const angle = cursor + width / 2 / radius;

    if (geometry) {
      // Local axes on the inner surface: x is the reading direction along the circumference,
      // z faces inward at the finger. `up` has to be −z for the basis to stay right-handed
      // with those two — take +z instead and the glyphs come out mirrored, since the basis
      // then flips rather than rotates.
      const reading = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
      const up = new THREE.Vector3(0, 0, -1);
      const inward = new THREE.Vector3(-Math.cos(angle), -Math.sin(angle), 0);

      const matrix = new THREE.Matrix4().makeBasis(reading, up, inward);
      matrix.setPosition(
        radius * Math.cos(angle),
        radius * Math.sin(angle),
        middle,
      );
      glyphs.push({ geometry, matrix });
    }

    cursor += (width + GAP) / radius;
  }

  return glyphs;
}
