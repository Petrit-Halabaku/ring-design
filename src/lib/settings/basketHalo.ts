/**
 * Basket & halo styles for the head.
 *
 * The settings API returns nine of these (see ./snapshot/baskethalo.json — None, Basket,
 * Pave Basket, Halo, Cushion Halo, Bezel, Double Halo, Hidden Halo, Secret Halo) but the
 * configurator's own UI offers the five below.
 *
 * The API's records also carry a `name` that the snapshot didn't keep — it only captured
 * `uiValue` and `description`. The configurator branches on that `name`, and only ever on
 * two values: "Classic" and "Bezel". `style` here is that name, so "Basket" maps to
 * "Classic"; the halo styles get their own labels but the bundle never tests for them in the
 * prong solve.
 */
export const BASKET_HALOS = [
  { id: "None", label: "None", style: null, hint: "No basket/halo" },
  { id: "Basket", label: "Basket", style: "Basket", hint: "Basket" },
  { id: "Halo", label: "Halo", style: "Classic", hint: "Pave Size 0.9mm" },
  { id: "Bezel", label: "Bezel", style: "Bezel", hint: "Bezel" },
  {
    id: "Hidden Halo",
    label: "Hidden Halo",
    style: "Hidden",
    hint: "Pave Size 0.9mm",
  },
] as const;

export type BasketHaloId = (typeof BASKET_HALOS)[number]["id"];

/** The `name` the configurator branches on, or null for a bare prong head. */
export type BasketHaloStyle = (typeof BASKET_HALOS)[number]["style"];

export const DEFAULT_BASKET_HALO: BasketHaloId = "None";

export function basketHaloStyle(id: string): BasketHaloStyle {
  return BASKET_HALOS.find((b) => b.id === id)?.style ?? null;
}

/**
 * Styles that seat the stone in a cage rather than on bare prongs — the only two the
 * configurator's prong solve reacts to, and the only two that take a wedge tip instead of a
 * styled claw.
 *
 * Confirmed against the source's own network traffic: selecting Halo pulls `WedgeTip60`,
 * Bezel pulls `WedgeTip50`, and Basket pulls neither (it stays on `WedgeTip45`/`Middle3`
 * like a bare head). Those are exactly the tilts this solve produces for "Classic" (60.2°),
 * "Bezel" (51.0°) and no style (46.1°) — which is how we know "Classic" is the *halo's*
 * style name, not the basket's.
 */
export function isCagedStyle(style: string | null): boolean {
  return style === "Classic" || style === "Bezel";
}

/**
 * Styles drawn from the basket rim parts. A plain basket strips the melee out of the blocks;
 * a hidden halo keeps them and pulls the rim in tight, which is the whole difference between
 * the two — the source loads the identical three GLBs for both.
 */
export function usesBasketRim(style: string | null): boolean {
  return style === "Basket" || style === "Hidden" || style === "Pave";
}

/** Whether the rim's melee are shown. `"Pave"` is the API's pavé-basket style. */
export function rimShowsStones(style: string | null): boolean {
  return style === "Hidden" || style === "Pave";
}
