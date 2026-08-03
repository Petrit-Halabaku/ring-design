/**
 * Petite French pavé — a run of melee set into the band's shoulders.
 *
 * Ported from the configurator's band component. Two things happen when pavé is switched on:
 *
 *   The band's **outer profile changes**. The dome is cut back by `shelf` and restarted further
 *   out, which leaves the flat seat the melee are set into. That is why the option cannot just
 *   add stones on top of a plain band — the band itself is a different shape.
 *
 *   A run of authored pieces is laid round the shoulders. Each is a small metal bead carrying
 *   one melee; the ends of each run take handed pieces with the bead omitted on the open side,
 *   so the run finishes flush instead of with a half bead.
 *
 * The run stops short of the head by however many slots the head occupies, and reaches as far
 * round as the chosen length allows.
 */
export const BAND_PAVE_LENGTHS = [
  "One Third",
  "Half",
  "Two Thirds",
  "Three Quarters",
  "Eternity",
] as const;

export type BandPaveLength = (typeof BAND_PAVE_LENGTHS)[number];

/** Fraction of the ring each length covers, before the head's own slots are taken out. */
const COVERAGE: Record<Exclude<BandPaveLength, "Eternity">, number> = {
  "One Third": 1 / 3,
  Half: 0.5,
  "Two Thirds": 2 / 3,
  "Three Quarters": 3 / 4,
};

/** Which of the three authored pieces a slot takes. */
export type BandPavePart = "middle" | "openLeft" | "openRight";

export type BandPavePlacement = {
  part: BandPavePart;
  /** Angle round the band, measured so that π/2 is the top, under the head. */
  angle: number;
};

/** An arc of the band the pavé pieces stand in for, in sweep radians measured from the head. */
export type BandPaveGap = { from: number; to: number };

export type BandPaveLayout = {
  placements: BandPavePlacement[];
  /**
   * Where the band must not be drawn.
   *
   * The authored pieces are full-width band segments — 1.70mm across, the band's own width —
   * overlapping at the pitch, so along the run they *are* the band. Draw the band underneath as
   * well and its crown arches over the stones, leaving only slivers showing either side of the
   * ridge. The source cuts the shank away here for exactly that reason.
   */
  gaps: BandPaveGap[];
  /** Radius the beads ride at. */
  radius: number;
  /** Uniform scale applied to each authored piece. */
  scale: number;
  /** How far the outer profile is cut back to make the seat. */
  shelf: number;
  /** Melee count, for the pavé report. */
  stoneCount: number;
};

/** The band's radial thickness once pavé has reshaped it. */
export function bandPaveThickness(width: number): number {
  const inner = 0.2 * 1.8;
  return inner + Math.max(0.8 * 1.8, 0.6351111111111111 * width);
}

export function bandPaveLayout(
  width: number,
  innerRadius: number,
  prongWidth: number,
  length: BandPaveLength,
): BandPaveLayout {
  const inner = 0.2 * 1.8;
  const reach = 0.6351111111111111 * width;
  const thickness = bandPaveThickness(width);
  const outer = thickness - inner;
  /** How far the dome is cut back — the seat's depth. */
  const shelf = outer - reach;

  const seat = innerRadius + inner;

  // Slot pitch, solved on the circumference the melee actually ride.
  const pitch = 0.888888888888889 * width + (0.1 + (width / 2.8) * 0.01);
  const inset = 0.15566666666666668 * width;
  const outerCircumference = 2 * Math.PI * (innerRadius + thickness);
  const paveCircumference = 2 * Math.PI * (innerRadius + thickness - inset);

  const slots = Math.floor(paveCircumference / pitch);
  if (slots <= 0) {
    return {
      placements: [],
      gaps: [],
      radius: seat,
      scale: width / 0.9,
      shelf,
      stoneCount: 0,
    };
  }
  const step = (2 * Math.PI) / slots;

  // Slots the head sits over, which the run has to start clear of.
  const blocked = ((2 * (prongWidth + 0.25)) / outerCircumference) * 2 * Math.PI;
  const taken = Math.ceil(blocked / step);

  const eternity = length === "Eternity";
  const covered = eternity
    ? slots
    : Math.round((COVERAGE[length] * slots) / 2);

  // The source walks half-steps and places on the odd ones, so the run can start on either
  // parity; an odd head span nudges the whole run over by half a slot to stay centred.
  const nudge = taken % 2 !== 0 ? step / 2 : 0;
  const placements: BandPavePlacement[] = [];
  const sweeps: number[] = [];

  const runEnd = 2 * covered - (taken % 2);
  const wrapStart = 2 * (slots - covered);
  const wrapEnd = 2 * slots - taken;

  for (let i = 0; i < 2 * slots + 1; i++) {
    if (i % 2 !== 1) continue;

    const inRun = eternity
      ? i >= taken && i < wrapEnd
      : (i >= taken && i < runEnd) || (i > wrapStart && i < wrapEnd);
    if (!inRun) continue;

    // The open-ended pieces cap each run so it doesn't finish on a half bead.
    let part: BandPavePart = "middle";
    if (i === taken || i === taken + 1 || (!eternity && i === wrapStart + 1)) {
      part = "openLeft";
    } else if (
      i === wrapEnd ||
      i === wrapEnd - 1 ||
      i === wrapEnd - 2 ||
      (!eternity && (i === runEnd - 1 || i === runEnd - 2))
    ) {
      part = "openRight";
    }

    placements.push({ part, angle: Math.PI / 2 - i * (step / 2) - nudge });
    sweeps.push(i * (step / 2) + nudge);
  }

  // One gap per run. Padded by half a pitch — comfortably inside the pieces' own overlap, so
  // the band's cut ends always finish underneath a piece rather than short of one.
  //
  // The head-side end takes a full pitch instead. A cathedral's shoulder carries its whole
  // section, and where that section starts it stands about a band thickness proud of the seat;
  // begin it half a pitch from the last stone and it rears up across that stone's trailing
  // edge. A full pitch puts the rise clear of the run, which is the only place it can go — the
  // shoulder has to reach full section somewhere before it meets the head.
  const gaps: BandPaveGap[] = [];
  if (sweeps.length) {
    const pad = step / 2;
    const headPad = step;
    // Sweep is measured from the head, so the end nearer 0 (or nearer 2π on the far run) is the
    // one facing it.
    const push = (lo: number, hi: number) => {
      const loFacesHead = Math.min(lo, 2 * Math.PI - hi) === lo;
      gaps.push({
        from: lo - (loFacesHead ? headPad : pad),
        to: hi + (loFacesHead ? pad : headPad),
      });
    };
    let from = sweeps[0];
    let prev = sweeps[0];
    for (let i = 1; i < sweeps.length; i++) {
      if (sweeps[i] - prev > step * 1.5) {
        push(from, prev);
        from = sweeps[i];
      }
      prev = sweeps[i];
    }
    push(from, prev);
  }

  return {
    placements,
    gaps,
    radius: seat + shelf - 0.007,
    scale: width / 0.9,
    shelf,
    stoneCount: placements.length,
  };
}
