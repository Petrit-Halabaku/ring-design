import type {
  BasketHalo,
  CaratWeights,
  MetalColor,
  ProngOption,
  RingSettings,
  Stone,
} from "./types";

import basketHaloSnapshot from "./snapshot/baskethalo.json";
import caratWeightSnapshot from "./snapshot/caratweight.json";
import colorSnapshot from "./snapshot/colors.json";
import prongArmSnapshot from "./snapshot/prong_arm.json";
import prongTipSnapshot from "./snapshot/prong_tip.json";
import stoneSnapshot from "./snapshot/stones.json";

/**
 * The configurator's settings come from a public REST backend. The live app calls
 * these on boot, in parallel, with no auth:
 *
 *   GET /stone-algo-backend/stone/get-all                      diamond shapes + geometry
 *   GET /stone-algo-backend/colorcustomisation/get-all         metal colours
 *   GET /stone-algo-backend/colorcustomisation/get-by-type/Prong
 *   GET /stone-algo-backend/prongoption/get-by-type/Arm        prong arm models
 *   GET /stone-algo-backend/prongoption/get-by-type/Tip        prong tip models
 *   GET /stone-algo-backend/baskethalo/get-all                 head styles
 *   GET /stone-algo-backend/caratweight/get-all                carat min/max per slot
 *   GET /stone-algo-backend/ring/get-by-key-for-config/{key}   a saved ring ("Ring Not Found" for unknown keys)
 *
 * It is a free-tier Render service and can cold-start slowly, so every call falls
 * back to a snapshot committed under ./snapshot. Set NEXT_PUBLIC_USE_LIVE_SETTINGS=1
 * to hit the network; otherwise the snapshot is used directly.
 */
export const SETTINGS_API_BASE =
  process.env.NEXT_PUBLIC_SETTINGS_API_BASE ??
  "https://sa-custom-backend.onrender.com/stone-algo-backend";

const USE_LIVE = process.env.NEXT_PUBLIC_USE_LIVE_SETTINGS === "1";

export const SNAPSHOT: RingSettings = {
  stones: stoneSnapshot as Stone[],
  metals: colorSnapshot as MetalColor[],
  prongArms: prongArmSnapshot as ProngOption[],
  prongTips: prongTipSnapshot as ProngOption[],
  basketHalos: basketHaloSnapshot as BasketHalo[],
  caratWeights: caratWeightSnapshot as CaratWeights,
};

async function get<T>(path: string, fallback: T, signal?: AbortSignal): Promise<T> {
  if (!USE_LIVE) return fallback;
  try {
    const res = await fetch(`${SETTINGS_API_BASE}/${path}`, { signal });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** Fetches every settings endpoint in parallel, as the original does on boot. */
export async function fetchRingSettings(
  signal?: AbortSignal,
): Promise<RingSettings> {
  const [stones, metals, prongArms, prongTips, basketHalos, caratWeights] =
    await Promise.all([
      get<Stone[]>("stone/get-all", SNAPSHOT.stones, signal),
      get<MetalColor[]>("colorcustomisation/get-all", SNAPSHOT.metals, signal),
      get<ProngOption[]>(
        "prongoption/get-by-type/Arm",
        SNAPSHOT.prongArms,
        signal,
      ),
      get<ProngOption[]>(
        "prongoption/get-by-type/Tip",
        SNAPSHOT.prongTips,
        signal,
      ),
      get<BasketHalo[]>("baskethalo/get-all", SNAPSHOT.basketHalos, signal),
      get<CaratWeights>("caratweight/get-all", SNAPSHOT.caratWeights, signal),
    ]);

  return { stones, metals, prongArms, prongTips, basketHalos, caratWeights };
}

/** Looks up a saved ring. The live backend 404s with "Ring Not Found" for unknown keys. */
export async function fetchSavedRing(key: string, signal?: AbortSignal) {
  const res = await fetch(
    `${SETTINGS_API_BASE}/ring/get-by-key-for-config/${encodeURIComponent(key)}`,
    { signal },
  );
  if (!res.ok) return null;
  return res.json();
}
