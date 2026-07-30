import type { Stone } from "./types";

/**
 * The configurator scales a stone by carat with a per-axis power law:
 *
 *   size(axis) = size1ct(axis) * carat ** caratWeightMultiplier[axis]
 *
 * The exponents sit near 1/3 because mass grows with volume, so doubling the
 * carat only widens a round by ~26%.
 */
export function stoneDimensionsAtCarat(stone: Stone, carat: number) {
  const { dimensions: d, caratWeightMultiplier: m } = stone;
  const l = Math.pow(carat, m.L);
  const w = Math.pow(carat, m.W);
  const dp = Math.pow(carat, m.D);

  return {
    length: round(d.length * l),
    width: round(d.width * w),
    depth: round(d.depth * dp),
    pavHeight: round(d.pavHeight * dp),
    girdleThickness: round(d.girdleThickness * dp),
    crownHeight: round(d.crownHeight * dp),
  };
}

/** Non-uniform scale factors to apply to a 1ct GLB to reach `carat`. */
export function stoneScaleAtCarat(
  stone: Stone,
  carat: number,
): [number, number, number] {
  const m = stone.caratWeightMultiplier;
  return [
    Math.pow(carat, m.L),
    Math.pow(carat, m.D),
    Math.pow(carat, m.W),
  ];
}

const round = (n: number) => parseFloat(n.toFixed(4));
