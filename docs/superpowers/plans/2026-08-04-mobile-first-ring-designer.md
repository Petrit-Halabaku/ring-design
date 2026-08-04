# Mobile-First Ring Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 3D ring designer as a mobile-first configurator — a bottom sheet with a category rail over an always-visible ring — replacing the six accordion cards that currently float over the canvas.

**Architecture:** `RingDesigner.tsx` (528 lines) decomposes into a shell, a draggable sheet, seven control primitives, and a state hook. The unlock is adding a render discriminant (`kind: "swatch" | "shape" | …`) to the option schema, which today can only describe text chips. Sheet geometry is owned in JavaScript and published to CSS as pixel custom properties, so the WebGL canvas never resizes during a drag.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, Tailwind CSS v4 (`@theme`), `@react-three/fiber` 9 + `@react-three/drei` 10, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-08-03-mobile-first-ring-designer-design.md`

---

## Global Constraints

- **No new dependencies.** No shadcn/ui, vaul, Radix, cva, or tailwind-merge. The sheet is hand-rolled pointer events.
- **No test framework.** The repo has no vitest/jest/playwright and this work does not add one. Every task verifies with `npx tsc --noEmit`, `npm run lint`, and the named manual checks. Do not write test files.
- **Out of scope, do not touch:** `RingWizard.tsx`, `LoadingScreen.tsx`, `styles/wizard.css` (beyond deleting the two rules named in Task 1), `SiteHeader.tsx`, `SiteFooter.tsx`, everything under `src/lib/settings/`, and `RingScene.tsx` except the two additions named in Tasks 4 and 6.
- **Do not re-enable the wizard.** `CustomRingBuilder.tsx:23-27` stays commented out.
- **No pricing anywhere.** The settings API exposes none. Never invent a price, a total, or a currency symbol.
- **Colour tokens, exact values:** sand `#f7f7f4` / `#eeeeea` / `#e4e5de` / `#d5d6cd`; hairline `#cfd0c7`; ink `#1c1d1e` / `#56574f` / `#8a8b82`; champagne `#a3854f` / `#f0e7d6`.
- **Selection rule:** selection state is always ink-900. Champagne is used *only* for the primary CTA and the category rail's active indicator. Never for a selected chip, swatch, tile, or segment.
- **Contrast rule:** ink-600 `#56574f` carries all hint and secondary text. ink-400 `#8a8b82` is ~2.6:1 on sand-200 and is decorative/disabled only — never body or hint text.
- **Type floor:** nothing below 13px. Labels 15px, hints 13px, numeric readouts 15px in Lora, rail 13px. Text inputs are 16px minimum (below that iOS Safari auto-zooms the page on focus).
- **Touch targets:** every interactive element ≥44×44 CSS px.
- **Motion:** all transitions collapse to `0ms` under `prefers-reduced-motion: reduce`.
- **Fonts:** Lora (`var(--font-serif)`) for the ring title, category headings, and numeric readouts. Roboto (`var(--font-sans)`) for everything else.
- **Commit style:** conventional commits, one commit per task, and `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` as the final line of every commit message.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/app/layout.tsx` | *modify* — add `viewport` export, import `designer.css` |
| `src/app/globals.css` | *modify* — `@theme` token block |
| `src/styles/designer.css` | *create* — stage backdrop, shell, sheet motion, range thumb, spinner |
| `src/styles/wizard.css` | *modify* — delete `.ring-stage-bg` and `.customizer-container` only |
| `src/lib/designer/types.ts` | *create* — `Control`, `ControlGroup`, `Category`, `DiamondType` |
| `src/lib/designer/useRingConfig.ts` | *create* — all ring state, named fields, derived values |
| `src/lib/designer/useVisualViewport.ts` | *create* — publishes `--app-h` from `visualViewport.height` |
| `src/lib/designer/categories.ts` | *create* — builds the five categories from config + settings |
| `src/lib/designer/shareCodec.ts` | *create* — config ⇄ URL hash (Task 7, cuttable) |
| `src/components/designer/DesignerShell.tsx` | *create* — composes stage + top bar + sheet |
| `src/components/designer/RingStage.tsx` | *create* — canvas, backdrop, rotate hint |
| `src/components/designer/TopBar.tsx` | *create* — wordmark, recenter, share |
| `src/components/designer/CategoryRail.tsx` | *create* — tablist |
| `src/components/designer/OptionSheet.tsx` | *create* — snap states, drag, keyboard |
| `src/components/designer/ReviewSheet.tsx` | *create* — summary dialog |
| `src/components/designer/controls/*.tsx` | *create* — `ControlGroup`, `SwatchRow`, `ShapeGrid`, `ChipRow`, `Segmented`, `Switch`, `RangeControl`, `TextField` |
| `src/components/three/RingScene.tsx` | *modify* — `CameraReset` child (Task 4), capture signal (Task 6) |
| `src/components/three/RingViewer.tsx` | *modify* — pass-through props, own spinner class |
| `src/components/builder/RingDesigner.tsx` | *modify* in Tasks 2–3, *delete* in Task 9 |
| `src/components/builder/CustomRingBuilder.tsx` | *modify* — point at `DesignerShell` (Task 4) |

---

## Task 1: Design tokens, viewport plumbing, and stylesheet independence

Foundation only. The app must look essentially unchanged after this task — the tokens exist but nothing consumes them yet.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/styles/designer.css`
- Modify: `src/styles/wizard.css:847-868` (delete two rules)
- Modify: `src/components/three/RingViewer.tsx:17`
- Modify: `src/components/builder/RingDesigner.tsx:321` (`customizer-container` → `designer-root`)

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utilities `bg-sand-{50,100,200,300}`, `text-ink-{900,600,400}`, `border-line`, `bg-champagne-500`, `text-champagne-500`, `rounded-{sm,md,lg,sheet}`, `shadow-card`, `shadow-sheet`, `ease-sheet`. CSS classes `.designer-root`, `.ring-stage-bg`, `.designer-spinner`.

- [ ] **Step 1: Replace `globals.css` with the token block**

The existing `@theme inline` block stays (it maps `--color-background` / `--color-foreground` and the two font families). Append a second `@theme` block:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #333333;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-roboto);
  --font-serif: var(--font-lora);
}

@theme {
  /* Surfaces. sand-200 is the vendor's stage colour (wizard.css:10). */
  --color-sand-50: #f7f7f4;
  --color-sand-100: #eeeeea;
  --color-sand-200: #e4e5de;
  --color-sand-300: #d5d6cd;
  --color-line: #cfd0c7;

  /* Ink. ink-900 is the vendor's near-black (wizard.css:76).
     ink-400 is ~2.6:1 on sand-200 — decorative/disabled only. */
  --color-ink-900: #1c1d1e;
  --color-ink-600: #56574f;
  --color-ink-400: #8a8b82;

  /* Accent. Primary CTA and the rail's active indicator, nothing else. */
  --color-champagne-500: #a3854f;
  --color-champagne-100: #f0e7d6;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-sheet: 24px;

  /* Warm-tinted elevation — never pure black. */
  --shadow-card: 0 1px 2px rgb(28 29 30 / 0.06), 0 4px 12px -4px rgb(28 29 30 / 0.08);
  --shadow-sheet: 0 -8px 32px -8px rgb(28 29 30 / 0.16);

  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-roboto), Roboto, sans-serif;
  font-size: 16px;
}

h1,
h2,
h3 {
  font-family: var(--font-lora), Lora, serif;
  font-weight: 400;
}
```

- [ ] **Step 2: Create `src/styles/designer.css`**

`.ring-stage-bg` and `.customizer-container` are moved verbatim from `wizard.css` (`.customizer-container` is renamed `.designer-root`), so the designer carries no dependency on the walkthrough stylesheet.

```css
/*
 * Ring designer shell. Deliberately independent of wizard.css — the walkthrough is
 * out of scope but its stylesheet stays loaded, so nothing here may reach into it.
 *
 * Geometry custom properties are written from JS (useVisualViewport, OptionSheet) as
 * plain px values. CSS only consumes them, so the calc() chains stay resolvable and
 * the canvas height never depends on the sheet's live drag position.
 */

.designer-root {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  z-index: 1003;
  background: var(--color-sand-200);
  overscroll-behavior: none;

  /* Fallbacks until JS measures. --app-h is overwritten on mount. */
  --app-h: 100dvh;
  --peek-h: 320px;
  --rail-h: 76px;
  --sheet-full-h: 480px;
  --sheet-y: 0px;
}

/*
 * Studio backdrop for the ring stage. The vendor applies these on `.wrapper` for
 * desktop and `.RingmobileContainer` for narrow layouts, from two separately
 * compressed images.
 */
.ring-stage-bg {
  background-image: url("/bg/bg-mobile.jpg");
  background-position: bottom;
  background-size: cover;
}

@media (min-width: 768px) {
  .ring-stage-bg {
    background-image: url("/bg/bg-desktop.jpg");
  }
}

.designer-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-sand-100);
  border-top-color: var(--color-ink-900);
  border-radius: 50%;
  animation: designer-spin 1s linear infinite;
}

@keyframes designer-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .designer-spinner {
    animation-duration: 2s;
  }
}
```

- [ ] **Step 3: Delete the moved rules from `wizard.css`**

Delete lines 843–868 — the `/* Studio backdrop for the ring stage... */` comment block, `.ring-stage-bg`, its `@media (min-width: 641px)` override, and the `/* ── 3D designer container ── */` comment with `.customizer-container`. The file must end at `.jos-state-header { padding: 0.85em 1em !important; }` and its closing brace.

`.customizer-container` is renamed `.designer-root` in `designer.css`, so its only consumer must be updated in the same task or the designer container silently loses `position: fixed` and every absolutely-positioned child reparents. Change `RingDesigner.tsx:321` from `className="customizer-container"` to `className="designer-root"`. (`.designer-root` sets a sand background where the old rule set white; the studio backdrop covers it, so this is not visible.)

- [ ] **Step 4: Add the viewport export and stylesheet import to `layout.tsx`**

Add to the imports and exports (keep `metadata`, the two font declarations, and `RootLayout` exactly as they are):

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/wizard.css";
import "@/styles/designer.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e4e5de",
};
```

Do **not** add `maximumScale` or `userScalable: false`. Pinch-zoom must stay available — jewellery is exactly what people zoom into, and disabling it is a WCAG 1.4.4 failure.

- [ ] **Step 5: Sever `RingViewer`'s wizard dependency**

In `src/components/three/RingViewer.tsx:17`, change `className="jos-loading-spinner"` to `className="designer-spinner"`.

- [ ] **Step 6: Verify the build and typecheck**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0.

- [ ] **Step 7: Verify nothing regressed visually**

Run `npm run dev`. At 390×844 in device emulation, confirm: the studio backdrop still renders behind the ring, the accordion cards still open and close, and the 3D spinner still animates while the scene loads. View source and confirm `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` is present.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/styles/designer.css \
        src/styles/wizard.css src/components/three/RingViewer.tsx
git commit -m "$(cat <<'EOF'
feat(designer): add design tokens, viewport plumbing, and designer.css

Moves .ring-stage-bg and .customizer-container out of the walkthrough
stylesheet so the designer carries no dependency on it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Named state model (`useRingConfig`)

Extracts every piece of ring state out of `RingDesigner.tsx` into a hook with **named** fields, replacing the positional `selections: Record<string, number>` record. Zero visual change — this is a refactor that de-risks everything after it, because a scene regression here is unambiguously attributable to the state move rather than to the new layout.

**Files:**
- Create: `src/lib/designer/types.ts`
- Create: `src/lib/designer/useRingConfig.ts`
- Modify: `src/components/builder/RingDesigner.tsx` (delete `:120-133`, `:135-149`, `:288-318`; rewrite the `RingViewer` prop block at `:333-359`)

**Interfaces:**
- Consumes: `SNAPSHOT`, `fetchRingSettings` from `@/lib/settings/client`; `hasLocalModel`, `localModelUrl`, `SHAPE_TO_STONE_NAME` from `@/lib/settings/models`; `PRONG_TIPS`, `prongAngles`, `prongCountsFor`, `prongTipModel`, `resolveProngCount`, `DEFAULT_PRONG_COUNT`, `DEFAULT_PRONG_TIP` from `@/lib/settings/prongs`; `BASKET_HALOS`, `DEFAULT_BASKET_HALO` from `@/lib/settings/basketHalo`; `BAND_STYLES`, `BAND_FITS` from `@/lib/settings/bandGeometry`; `BAND_PAVE_LENGTHS` from `@/lib/settings/bandPave`.
- Produces: `useRingConfig(init) → RingConfig`, whose exact shape Tasks 3–9 all consume:

```ts
type RingConfig = {
  settings: RingSettings;
  stones: Stone[];          // filtered to those with local GLBs
  stone: Stone;
  metal: Metal;
  prongMetal: Metal;
  caratRange: { min: number; max: number };
  prongCountOptions: ProngCount[];
  activeProngCount: ProngCount;
  angles: number[];
  value: RingValue;
  set: RingSetters;
};
```

- [ ] **Step 1: Create `src/lib/designer/types.ts`**

```ts
import type { BandFit, BandStyle } from "@/lib/settings/bandGeometry";
import type { BandPaveLength } from "@/lib/settings/bandPave";
import type { BasketHaloId } from "@/lib/settings/basketHalo";
import type { ProngCount, ProngTipId } from "@/lib/settings/prongs";

/**
 * Display-only in the current build — the vendor's configurator tints its option text by
 * this but renders the same geometry either way. Held in state so the review sheet can
 * report it; it drives nothing in RingScene.
 */
export type DiamondType = "Natural" | "Lab Grown";

export type EngravingFont = "Block" | "Cursive";

/** Every ring choice, by name. Replaces the positional `selections` record. */
export type RingValue = {
  metalIdx: number;
  stoneIdx: number;
  carat: number;
  diamondType: DiamondType;
  basketHalo: BasketHaloId;
  prongCount: ProngCount;
  prongTip: ProngTipId;
  prongPave: boolean;
  /** null = prongs follow the band. The configurator calls a split "Mixed". */
  prongMetalIdx: number | null;
  bandStyle: BandStyle;
  cathedral: boolean;
  bandPave: boolean;
  bandPaveLength: BandPaveLength;
  bandFit: BandFit;
  bandWidth: number;
  ringSize: number;
  engravingFont: EngravingFont;
  engravingText: string;
  surpriseStones: boolean;
};

```

`RingConfig` is derived as `ReturnType<typeof useRingConfig>`, so there is deliberately no
hand-written setter interface here — a second declaration of the same nineteen setters is
just something to drift out of sync.

- [ ] **Step 2: Create `src/lib/designer/useRingConfig.ts`**

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRingSettings, SNAPSHOT } from "@/lib/settings/client";
import { hasLocalModel, SHAPE_TO_STONE_NAME } from "@/lib/settings/models";
import {
  DEFAULT_PRONG_COUNT,
  DEFAULT_PRONG_TIP,
  prongAngles,
  prongCountsFor,
  resolveProngCount,
} from "@/lib/settings/prongs";
import { DEFAULT_BASKET_HALO, type BasketHaloId } from "@/lib/settings/basketHalo";
import type { RingSettings } from "@/lib/settings/types";
import type { RingValue } from "./types";

export type RingConfigInit = { shapeId?: string; carat?: number };

const DEFAULTS = {
  carat: 1,
  diamondType: "Natural",
  bandStyle: "Round",
  cathedral: false,
  bandPave: false,
  bandPaveLength: "Half",
  bandFit: "Comfort Fit",
  bandWidth: 1.7,
  ringSize: 6,
  engravingFont: "Block",
  engravingText: "",
  surpriseStones: false,
} as const;

export function useRingConfig({ shapeId, carat: initialCarat }: RingConfigInit) {
  const [settings, setSettings] = useState<RingSettings>(SNAPSHOT);

  const [value, setValue] = useState<RingValue>(() => ({
    // 18K Yellow is the configurator's default.
    metalIdx: Math.max(0, SNAPSHOT.metals.findIndex((m) => m.uiValue === "18K Yellow")),
    // Indexes into the filtered list the picker renders, not the raw API order.
    stoneIdx: Math.max(
      0,
      SNAPSHOT.stones
        .filter((s) => hasLocalModel(s.glbUrl))
        .findIndex((s) => s.name === (shapeId ? SHAPE_TO_STONE_NAME[shapeId] : "Round")),
    ),
    carat: initialCarat ?? DEFAULTS.carat,
    diamondType: DEFAULTS.diamondType,
    basketHalo: DEFAULT_BASKET_HALO,
    prongCount: DEFAULT_PRONG_COUNT,
    prongTip: DEFAULT_PRONG_TIP,
    prongPave: false,
    prongMetalIdx: null,
    bandStyle: DEFAULTS.bandStyle,
    cathedral: DEFAULTS.cathedral,
    bandPave: DEFAULTS.bandPave,
    bandPaveLength: DEFAULTS.bandPaveLength,
    bandFit: DEFAULTS.bandFit,
    bandWidth: DEFAULTS.bandWidth,
    ringSize: DEFAULTS.ringSize,
    engravingFont: DEFAULTS.engravingFont,
    engravingText: DEFAULTS.engravingText,
    surpriseStones: DEFAULTS.surpriseStones,
  }));

  // The live app fetches every settings endpoint on boot; the snapshot seeds the first
  // paint so the canvas never waits on a cold Render dyno.
  useEffect(() => {
    const ac = new AbortController();
    fetchRingSettings(ac.signal).then(setSettings).catch(() => {});
    return () => ac.abort();
  }, []);

  const patch = useCallback(
    <K extends keyof RingValue>(k: K, v: RingValue[K]) =>
      setValue((prev) => {
        const next = { ...prev, [k]: v };
        // Switching a cathedral on with a bare head fits a basket for the shoulders to
        // land on. Ported from the vendor's handler, which reads
        // `"None" !== e && "None" === basketHalo` — so it only fills an empty choice.
        // A halo, bezel or hidden halo already gives the shoulders something to meet.
        if (k === "cathedral" && v === true && prev.basketHalo === "None") {
          next.basketHalo = "Basket" as BasketHaloId;
        }
        return next;
      }),
    [],
  );

  // Only offer shapes whose GLB is actually available (see hasLocalModel).
  const stones = useMemo(
    () => settings.stones.filter((s) => hasLocalModel(s.glbUrl)),
    [settings.stones],
  );
  const stone = stones[value.stoneIdx] ?? stones[0] ?? SNAPSHOT.stones[0];
  const metal = settings.metals[value.metalIdx] ?? SNAPSHOT.metals[0];
  const prongMetal =
    value.prongMetalIdx === null
      ? metal
      : (settings.metals[value.prongMetalIdx] ?? metal);

  // Layouts depend on the shape: a marquise only takes six prongs, a princess only four,
  // and a pear takes three or five. Keep the selection valid as the shape changes.
  const prongCountOptions = useMemo(
    () => prongCountsFor(stone, value.carat),
    [stone, value.carat],
  );
  const activeProngCount = resolveProngCount(stone, value.carat, value.prongCount);
  const angles = useMemo(
    () => prongAngles(stone, value.carat, activeProngCount),
    [stone, value.carat, activeProngCount],
  );

  const set = useMemo(
    () => ({
      setMetalIdx: (v: number) => patch("metalIdx", v),
      setStoneIdx: (v: number) => patch("stoneIdx", v),
      setCarat: (v: number) => patch("carat", v),
      setDiamondType: (v: RingValue["diamondType"]) => patch("diamondType", v),
      setBasketHalo: (v: RingValue["basketHalo"]) => patch("basketHalo", v),
      setProngCount: (v: RingValue["prongCount"]) => patch("prongCount", v),
      setProngTip: (v: RingValue["prongTip"]) => patch("prongTip", v),
      setProngPave: (v: boolean) => patch("prongPave", v),
      setProngMetalIdx: (v: number | null) => patch("prongMetalIdx", v),
      setBandStyle: (v: RingValue["bandStyle"]) => patch("bandStyle", v),
      setCathedral: (v: boolean) => patch("cathedral", v),
      setBandPave: (v: boolean) => patch("bandPave", v),
      setBandPaveLength: (v: RingValue["bandPaveLength"]) => patch("bandPaveLength", v),
      setBandFit: (v: RingValue["bandFit"]) => patch("bandFit", v),
      setBandWidth: (v: number) => patch("bandWidth", v),
      setRingSize: (v: number) => patch("ringSize", v),
      setEngravingFont: (v: RingValue["engravingFont"]) => patch("engravingFont", v),
      setEngravingText: (v: string) => patch("engravingText", v),
      setSurpriseStones: (v: boolean) => patch("surpriseStones", v),
    }),
    [patch],
  );

  return {
    settings,
    stones,
    stone,
    metal,
    prongMetal,
    caratRange: settings.caratWeights.solitaire.center,
    prongCountOptions,
    activeProngCount,
    angles,
    value,
    set,
  };
}

export type RingConfig = ReturnType<typeof useRingConfig>;
```

- [ ] **Step 3: Rewire `RingDesigner.tsx` onto the hook**

Delete the twelve `useState` calls (`:120-133`), the two initialiser `useState`s (`:135-149`), the settings `useEffect` (`:153-157`), the `stones`/`stone`/`metal`/`caratRange`/`prongCountOptions`/`activeProngCount`/`angles`/`prongMetal` derivations (`:160-180`), and the whole `key()` / `choose()` / `activeChoice()` block (`:288-318`). Replace with:

```tsx
const cfg = useRingConfig({ shapeId, carat: initialCarat });
const { settings, stones, stone, metal, prongMetal, caratRange,
        prongCountOptions, activeProngCount, angles, value, set } = cfg;
```

Then rewrite the `panels` memo's `choose` call sites to hit named setters, and replace the `RingViewer` prop block (`:333-359`) with:

```tsx
<RingViewer
  stone={stone}
  stoneModel={localModelUrl(stone.glbUrl)}
  carat={value.carat}
  metalColor={metal.material.color}
  ringSize={value.ringSize}
  bandWidthMm={value.bandWidth}
  prongAngles={angles}
  prongCountType={activeProngCount}
  prongTipModel={prongTipModel(value.prongTip)}
  prongTipId={value.prongTip}
  prongMetalColor={prongMetal.material.color}
  prongPave={value.prongPave}
  basketHalo={value.basketHalo}
  cathedral={value.cathedral}
  bandStyle={value.bandStyle}
  bandFit={value.bandFit}
  engravingText={value.engravingText}
  engravingFont={value.engravingFont}
  surpriseStones={value.surpriseStones}
  bandPave={value.bandPave}
  bandPaveLength={value.bandPaveLength}
/>
```

Note the `?? "Round"` / `?? "Comfort Fit"` / `?? "Half"` fallbacks from the old positional lookups are gone — the hook's initial state guarantees a valid value, so the fallbacks were dead branches.

The hook now owns the settings fetch and every derivation, so several of `RingDesigner`'s
imports go unused: `useEffect`, `useState`, `fetchRingSettings`, `SNAPSHOT`,
`SHAPE_TO_STONE_NAME`, `hasLocalModel`, `prongAngles`, `prongCountsFor`,
`resolveProngCount`, `DEFAULT_PRONG_COUNT`, `DEFAULT_PRONG_TIP`, `DEFAULT_BASKET_HALO`, and
the `RingSettings` type. Remove them — `npm run lint` in Step 4 will fail otherwise. Keep
`useMemo`, `localModelUrl`, `prongTipModel`, `PRONG_TIPS`, `BASKET_HALOS`, `BAND_STYLES`,
`BAND_FITS`, and `BAND_PAVE_LENGTHS`, which the `panels` memo still uses.

- [ ] **Step 4: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0. `selections`, `activeChoice`, and `key` must no longer appear anywhere in `RingDesigner.tsx` — confirm with `grep -n "selections\|activeChoice" src/components/builder/RingDesigner.tsx`, which should print nothing.

- [ ] **Step 5: Verify every control still drives the scene**

Run `npm run dev` and walk this list, watching the 3D ring after each. Any that fails to change the render is a regression from the positional-key removal.

1. Metal → pick 14K Rose: band colour changes.
2. Diamonds → pick Emerald: stone shape changes. Carat slider to 3: stone grows.
3. Head → Halo: a halo appears. Prong Tips → Claw: tips change. Prong Pave → Pave: arms gain melee. Prong Metal → 18K White: prongs go white while the band stays.
4. Band → Cathedral: shoulders rise **and** the Basket & Halo hint flips from "No basket/halo" to "Basket" (this is the ported coupling — verify it, it is the single most breakable behaviour in this task).
5. Band → Pave Style → Petite French, then Pave Length → Eternity: melee wraps the whole shank.
6. Band → Style → Square: band profile squares off. Fit → Standard Fit: inner profile changes. Width to 4.0 and Ring Size to 13: band thickens and widens.
7. More → type `HELLO` in engraving: text appears inside the band. Engraving Style → Cursive: face changes. Surprise Stones → Add Stones: stones appear inside the shank.

- [ ] **Step 6: Commit**

```bash
git add src/lib/designer/types.ts src/lib/designer/useRingConfig.ts \
        src/components/builder/RingDesigner.tsx
git commit -m "$(cat <<'EOF'
refactor(designer): move ring state into useRingConfig with named fields

Replaces the positional `selections` record, where selections["band-1"] was
cathedral and ["band-4"] was pave length, so reordering a group could
silently rewire the 3D scene.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Control primitives and the category schema

Builds the seven controls plus `ControlGroup`, and `categories.ts` which maps every group to a control kind. Renders them inside the *existing* accordion chrome, so the app gains real swatches, shape tiles, switches and tick-marked sliders one task before the layout changes. Each task ships visible value and the app never sits broken.

**Files:**
- Create: `src/components/designer/controls/ControlGroup.tsx`, `SwatchRow.tsx`, `ShapeGrid.tsx`, `ChipRow.tsx`, `Segmented.tsx`, `Switch.tsx`, `RangeControl.tsx`, `TextField.tsx`
- Create: `src/lib/designer/categories.ts`
- Modify: `src/lib/designer/types.ts` (add `Control`, `ControlGroup`, `Category`)
- Modify: `src/components/builder/RingDesigner.tsx` (replace the `panel.groups.map` body at `:402-431` and delete the bespoke slider/text blocks at `:433-517`)

**Interfaces:**
- Consumes: `RingConfig` from Task 2.
- Produces: `buildCategories(cfg: RingConfig): Category[]`, and `<ControlGroup group={g} />` which dispatches on `g.control.kind`. Task 4's `CategoryRail` consumes `Category.id` / `.label` / `.icon`; Task 6's `ReviewSheet` consumes `Category.groups[].label` and `.hint`.

- [ ] **Step 1: Add the schema types to `src/lib/designer/types.ts`**

Add `import type { ReactNode } from "react";` to the **existing import block at the top of the
file** — not with the appended types below, or the file will have an import in the middle of
its body and fail to parse. Then append:

```ts
export type SwatchOption = { id: string; label: string; hex: string };
export type IconOption = { id: string; label: string; svg: string };
export type TextOption = { id: string; label: string };

/**
 * The render discriminant. The previous schema was `{ label, choices: { label }[] }`,
 * which could only describe text chips — which is exactly why a metal colour and a
 * diamond shape rendered identically.
 */
export type Control =
  | { kind: "swatch"; options: SwatchOption[]; value: string; onChange: (id: string) => void }
  | { kind: "shape"; options: IconOption[]; value: string; onChange: (id: string) => void }
  | { kind: "chip"; options: TextOption[]; value: string; onChange: (id: string) => void }
  | { kind: "segmented"; options: TextOption[]; value: string; onChange: (id: string) => void }
  | { kind: "switch"; value: boolean; onChange: (next: boolean) => void }
  | {
      kind: "range";
      min: number;
      max: number;
      step: number;
      value: number;
      presets?: number[];
      format: (n: number) => string;
      onChange: (next: number) => void;
    }
  | {
      kind: "text";
      maxLength: number;
      value: string;
      onChange: (next: string) => void;
    };

export type ControlGroupModel = {
  id: string;
  label: string;
  hint?: string;
  control: Control;
};

export type Category = {
  id: string;
  label: string;
  icon: ReactNode;
  groups: ControlGroupModel[];
};
```

- [ ] **Step 2: Create `SwatchRow.tsx`**

```tsx
"use client";

import type { SwatchOption } from "@/lib/designer/types";

type Props = {
  options: SwatchOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

/**
 * Metal colours, filled with the hex the settings API reports. The selected metal's name
 * prints below the row rather than one label per swatch — seven labels in a scrolling row
 * is unreadable on a phone.
 */
export default function SwatchRow({ options, value, onChange, label }: Props) {
  const selected = options.find((o) => o.id === value);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              onClick={() => onChange(o.id)}
              className="grid size-11 shrink-0 snap-start place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
            >
              <span
                className={`block size-9 rounded-full border border-line ${
                  active ? "ring-2 ring-ink-900 ring-offset-[3px] ring-offset-sand-50" : ""
                }`}
                style={{ background: o.hex }}
              />
            </button>
          );
        })}
      </div>
      {selected && (
        <p className="mt-2 font-serif text-[15px] text-ink-900">{selected.label}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `ShapeGrid.tsx`**

```tsx
/* eslint-disable @next/next/no-img-element -- inline SVGs from /public/shapes, sized by CSS */
"use client";

import type { IconOption } from "@/lib/designer/types";

type Props = {
  options: IconOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

export default function ShapeGrid({ options, value, onChange, label }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-md border px-1 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
              active
                ? "border-ink-900 bg-sand-100"
                : "border-line bg-transparent hover:border-ink-400"
            }`}
          >
            <img src={o.svg} alt="" aria-hidden className="size-10" />
            <span className="text-[13px] leading-tight text-ink-900">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create `ChipRow.tsx`**

```tsx
"use client";

import type { TextOption } from "@/lib/designer/types";

type Props = {
  options: TextOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

export default function ChipRow({ options, value, onChange, label }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`inline-flex min-h-11 items-center rounded-md border px-3.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
              active
                ? "border-ink-900 bg-ink-900 text-sand-50"
                : "border-line text-ink-900 hover:border-ink-400"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create `Segmented.tsx`**

```tsx
"use client";

import type { TextOption } from "@/lib/designer/types";

type Props = {
  options: TextOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
};

/** Two or three mutually exclusive options. Four or more should use ChipRow. */
export default function Segmented({ options, value, onChange, label }: Props) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative flex min-h-11 rounded-md bg-sand-100 p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-sm bg-ink-900 transition-[left] duration-200 ease-sheet motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          left: `calc(0.25rem + (100% - 0.5rem) / ${options.length} * ${index})`,
        }}
      />
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`relative z-10 flex-1 rounded-sm px-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
              active ? "text-sand-50" : "text-ink-600"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Create `Switch.tsx`**

```tsx
"use client";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
};

export default function Switch({ value, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="grid min-h-11 w-[52px] items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
    >
      <span
        className={`relative block h-8 w-[52px] rounded-full transition-colors duration-200 motion-reduce:transition-none ${
          value ? "bg-ink-900" : "bg-sand-300"
        }`}
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-sand-50 shadow-card transition-[left] duration-200 ease-sheet motion-reduce:transition-none ${
            value ? "left-[24px]" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}
```

- [ ] **Step 7: Create `RangeControl.tsx`**

```tsx
"use client";

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  presets?: number[];
  format: (n: number) => string;
  onChange: (next: number) => void;
  label: string;
};

/**
 * Preset ticks are the point of this control: dragging a native range to exactly 1.00ct
 * on a phone is miserable, so the common values are one tap.
 */
export default function RangeControl({
  min,
  max,
  step,
  value,
  presets,
  format,
  onChange,
  label,
}: Props) {
  return (
    <div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="designer-range w-full"
      />
      {presets && presets.length > 0 && (
        <div className="mt-1 flex justify-between">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`min-h-11 min-w-11 text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
                Math.abs(p - value) < step / 2 ? "text-ink-900" : "text-ink-600"
              }`}
            >
              {format(p)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Append the thumb styling to `src/styles/designer.css`. A 28px visual thumb inside a 44px hit area — the current native sliders are roughly 16px and genuinely hard to hit:

```css
.designer-range {
  -webkit-appearance: none;
  appearance: none;
  height: 44px;
  background: transparent;
  touch-action: pan-y;
}

.designer-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: var(--color-sand-300);
}

.designer-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  margin-top: -12px;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  background: var(--color-sand-50);
  box-shadow: var(--shadow-card);
}

.designer-range::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: var(--color-sand-300);
}

.designer-range::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  background: var(--color-sand-50);
  box-shadow: var(--shadow-card);
}

.designer-range:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--color-champagne-500);
  outline-offset: 2px;
}

.designer-range:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--color-champagne-500);
  outline-offset: 2px;
}
```

- [ ] **Step 8: Create `TextField.tsx`**

```tsx
"use client";

type Props = {
  value: string;
  maxLength: number;
  onChange: (next: string) => void;
  label: string;
};

/**
 * 16px font is load-bearing, not taste: iOS Safari auto-zooms the whole page on focus for
 * any input below 16px, which the previous 12px engraving field did on every tap.
 */
export default function TextField({ value, maxLength, onChange, label }: Props) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        aria-label={label}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        enterKeyHint="done"
        className="min-h-11 flex-1 rounded-md border border-line bg-sand-50 px-3 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
      />
      <span className="shrink-0 font-serif text-[15px] tabular-nums text-ink-600">
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
```

- [ ] **Step 9: Create `ControlGroup.tsx`**

```tsx
"use client";

import type { ControlGroupModel } from "@/lib/designer/types";
import ChipRow from "./ChipRow";
import RangeControl from "./RangeControl";
import Segmented from "./Segmented";
import ShapeGrid from "./ShapeGrid";
import SwatchRow from "./SwatchRow";
import Switch from "./Switch";
import TextField from "./TextField";

/** Label + hint + the control the group's `kind` selects. */
export default function ControlGroup({ group }: { group: ControlGroupModel }) {
  const c = group.control;

  return (
    <section className="py-4 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-[15px] leading-snug text-ink-900">
            {group.label}
          </h3>
          {group.hint && (
            <p className="mt-0.5 text-[13px] leading-snug text-ink-600">{group.hint}</p>
          )}
        </div>

        {/* Compact controls sit on the heading row; wide ones drop below it. */}
        {c.kind === "switch" && (
          <Switch value={c.value} onChange={c.onChange} label={group.label} />
        )}
        {c.kind === "range" && (
          <span className="shrink-0 font-serif text-[15px] tabular-nums text-ink-900">
            {c.format(c.value)}
          </span>
        )}
      </div>

      <div className={c.kind === "switch" ? "" : "mt-3"}>
        {c.kind === "swatch" && (
          <SwatchRow
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "shape" && (
          <ShapeGrid
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "chip" && (
          <ChipRow
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "segmented" && (
          <Segmented
            options={c.options}
            value={c.value}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "range" && (
          <RangeControl
            min={c.min}
            max={c.max}
            step={c.step}
            value={c.value}
            presets={c.presets}
            format={c.format}
            onChange={c.onChange}
            label={group.label}
          />
        )}
        {c.kind === "text" && (
          <TextField
            value={c.value}
            maxLength={c.maxLength}
            onChange={c.onChange}
            label={group.label}
          />
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 10: Create `src/lib/designer/categories.ts`**

Five categories, nineteen groups. "More" is gone — its engraving font, engraving text and surprise stones belong in Engraving. Option counts are verified against the real constants: `BASKET_HALOS` has 5 (`basketHalo.ts:15-20`), `PRONG_TIPS` has 4 (`prongs.ts:152-155`), `BAND_PAVE_LENGTHS` has 5 (`bandPave.ts:17`), `BAND_STYLES` and `BAND_FITS` have 2 each (`bandGeometry.ts:26-27`), metals 7, shapes 9.

```ts
import { BAND_FITS, BAND_STYLES } from "@/lib/settings/bandGeometry";
import { BAND_PAVE_LENGTHS } from "@/lib/settings/bandPave";
import { BASKET_HALOS } from "@/lib/settings/basketHalo";
import { PRONG_TIPS } from "@/lib/settings/prongs";
import { STONE_NAME_TO_SHAPE } from "@/lib/settings/models";
import type { RingConfig } from "./useRingConfig";
import type { Category, TextOption } from "./types";

const ct = (n: number) => `${n.toFixed(2)} ct`;
const mm = (n: number) => `${n.toFixed(1)} mm`;
const us = (n: number) => `${n.toFixed(2)}`;

const asOptions = (xs: readonly string[]): TextOption[] =>
  xs.map((x) => ({ id: x, label: x }));

export function buildCategories(cfg: RingConfig): Category[] {
  const { settings, stones, stone, metal, prongMetal, caratRange, value, set } = cfg;

  return [
    {
      id: "metal",
      label: "Metal",
      icon: ICONS.metal,
      groups: [
        {
          id: "metal-color",
          label: "Head & Band Colour",
          hint: metal.description,
          control: {
            kind: "swatch",
            options: settings.metals.map((m) => ({
              id: m.uiValue,
              label: m.uiValue,
              hex: m.backgroundColor,
            })),
            value: metal.uiValue,
            onChange: (id) =>
              set.setMetalIdx(settings.metals.findIndex((m) => m.uiValue === id)),
          },
        },
      ],
    },
    {
      id: "stone",
      label: "Stone",
      icon: ICONS.stone,
      groups: [
        {
          id: "stone-shape",
          label: "Shape",
          hint: `${ct(value.carat)} ${stone.name}`,
          control: {
            kind: "shape",
            options: stones.map((s) => ({
              id: s.name,
              label: s.name,
              svg: `/shapes/${STONE_NAME_TO_SHAPE[s.name]}.svg`,
            })),
            value: stone.name,
            onChange: (id) => set.setStoneIdx(stones.findIndex((s) => s.name === id)),
          },
        },
        {
          id: "stone-type",
          label: "Diamond Type",
          hint: "Applies to the centre stone and pave, where present",
          control: {
            kind: "segmented",
            options: asOptions(["Natural", "Lab Grown"]),
            value: value.diamondType,
            onChange: (id) => set.setDiamondType(id as typeof value.diamondType),
          },
        },
        {
          id: "stone-carat",
          label: "Carat Weight",
          control: {
            kind: "range",
            min: caratRange.min,
            max: caratRange.max,
            step: 0.05,
            value: value.carat,
            presets: [0.5, 1, 1.5, 2, 3].filter(
              (p) => p >= caratRange.min && p <= caratRange.max,
            ),
            format: ct,
            onChange: set.setCarat,
          },
        },
      ],
    },
    {
      id: "head",
      label: "Head",
      icon: ICONS.head,
      groups: [
        {
          id: "head-basket",
          label: "Basket & Halo",
          hint: BASKET_HALOS.find((b) => b.id === value.basketHalo)?.hint,
          control: {
            kind: "chip",
            options: BASKET_HALOS.map((b) => ({ id: b.id, label: b.label })),
            value: value.basketHalo,
            onChange: (id) => set.setBasketHalo(id as typeof value.basketHalo),
          },
        },
        {
          id: "head-prong-count",
          label: "Prong Count",
          hint: `${cfg.angles.length} prongs`,
          control: {
            kind: "segmented",
            options: cfg.prongCountOptions.map((c) => ({ id: c, label: c })),
            value: cfg.activeProngCount,
            onChange: (id) => set.setProngCount(id as typeof value.prongCount),
          },
        },
        {
          id: "head-prong-tip",
          label: "Prong Tips",
          control: {
            kind: "chip",
            options: PRONG_TIPS.map((t) => ({ id: t.id, label: t.label })),
            value: value.prongTip,
            onChange: (id) => set.setProngTip(id as typeof value.prongTip),
          },
        },
        {
          id: "head-prong-pave",
          label: "Prong Pave",
          hint: value.prongPave ? "Pave prong arms" : "Plain prong arms",
          control: {
            kind: "switch",
            value: value.prongPave,
            onChange: set.setProngPave,
          },
        },
        {
          id: "head-prong-metal",
          label: "Prong Metal",
          hint: value.prongMetalIdx === null ? "Matches the band" : prongMetal.description,
          control: {
            kind: "swatch",
            options: [
              { id: MATCH_BAND, label: "Match Band", hex: metal.material.color },
              ...settings.metals.map((m) => ({
                id: m.uiValue,
                label: m.uiValue,
                hex: m.backgroundColor,
              })),
            ],
            value: value.prongMetalIdx === null ? MATCH_BAND : prongMetal.uiValue,
            onChange: (id) =>
              set.setProngMetalIdx(
                id === MATCH_BAND
                  ? null
                  : settings.metals.findIndex((m) => m.uiValue === id),
              ),
          },
        },
      ],
    },
    {
      id: "band",
      label: "Band",
      icon: ICONS.band,
      groups: [
        {
          id: "band-style",
          label: "Style",
          control: {
            kind: "segmented",
            options: asOptions(BAND_STYLES),
            value: value.bandStyle,
            onChange: (id) => set.setBandStyle(id as typeof value.bandStyle),
          },
        },
        {
          id: "band-cathedral",
          label: "Cathedral",
          hint: "Raises the shoulders to meet the head",
          control: { kind: "switch", value: value.cathedral, onChange: set.setCathedral },
        },
        {
          id: "band-pave",
          label: "Pave",
          hint: value.bandPave ? "Petite French" : "No pave",
          control: { kind: "switch", value: value.bandPave, onChange: set.setBandPave },
        },
        {
          id: "band-pave-length",
          label: "Pave Length",
          control: {
            kind: "chip",
            options: asOptions(BAND_PAVE_LENGTHS),
            value: value.bandPaveLength,
            onChange: (id) => set.setBandPaveLength(id as typeof value.bandPaveLength),
          },
        },
        {
          id: "band-fit",
          label: "Fit",
          control: {
            kind: "segmented",
            options: asOptions(BAND_FITS),
            value: value.bandFit,
            onChange: (id) => set.setBandFit(id as typeof value.bandFit),
          },
        },
        {
          id: "band-width",
          label: "Band Width",
          control: {
            kind: "range",
            min: 1.5,
            max: 4,
            step: 0.1,
            value: value.bandWidth,
            presets: [1.5, 2, 2.5, 3, 4],
            format: mm,
            onChange: set.setBandWidth,
          },
        },
        {
          id: "band-size",
          label: "Ring Size",
          hint: "US / Canada standard sizing",
          control: {
            kind: "range",
            min: 3,
            max: 13,
            step: 0.25,
            value: value.ringSize,
            presets: [4, 6, 8, 10, 12],
            format: us,
            onChange: set.setRingSize,
          },
        },
      ],
    },
    {
      id: "engraving",
      label: "Engraving",
      icon: ICONS.engraving,
      groups: [
        {
          id: "engraving-text",
          label: "Inscription",
          hint: "Up to 14 characters, engraved inside the band",
          control: {
            kind: "text",
            maxLength: 14,
            value: value.engravingText,
            onChange: set.setEngravingText,
          },
        },
        {
          id: "engraving-font",
          label: "Font",
          control: {
            kind: "segmented",
            options: asOptions(["Block", "Cursive"]),
            value: value.engravingFont,
            onChange: (id) => set.setEngravingFont(id as typeof value.engravingFont),
          },
        },
        {
          id: "engraving-surprise",
          label: "Surprise Stones",
          hint: "Hidden stones set inside the shank",
          control: {
            kind: "switch",
            value: value.surpriseStones,
            onChange: set.setSurpriseStones,
          },
        },
      ],
    },
  ];
}

/** Sentinel for the prong-metal swatch that defers to the band. */
export const MATCH_BAND = "__match_band__";
```

Two things to resolve while writing this file:

1. **`ICONS`** — define it at the top of `categories.ts` as `Record<string, ReactNode>` holding five 20px inline `<svg>` elements at `strokeWidth={1.5}`, reusing the existing path data where it exists: metal `"M12 2l4 6-4 14L8 8z"` and band `"M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 110 10 5 5 0 010-10z"` are already in `RingDesigner.tsx:110` and `:48`; head is `"M12 3l3 5H9zM5 10h14l-7 11z"` (`:109`); stone is `"M6 3h12l4 6-10 12L2 9z"` (`:111`); for engraving use `"M4 7h16M4 12h10"`.

2. **`STONE_NAME_TO_SHAPE`** — `models.ts` currently exports only `SHAPE_TO_STONE_NAME`. Add the inverse next to it, derived rather than hand-written so the two can't drift:

```ts
export const STONE_NAME_TO_SHAPE: Record<string, string> = Object.fromEntries(
  Object.entries(SHAPE_TO_STONE_NAME).map(([shape, name]) => [name, shape]),
);
```

3. **The swatch colour field is `backgroundColor`** — resolved, not a guess: `settings/types.ts:42` declares `backgroundColor: string` and there is no `swatchColor`. Use it directly; it is always present, so no fallback is needed.

   This matters beyond naming. `material.color` is the *render* colour passed to the 3D material, and for 14K White Gold it is `#ffffff` — building swatches from it would draw white gold as an invisible circle on the sand sheet. `backgroundColor` is the intended swatch value (`#B0B0B0` for white, `#F4AA3C` for yellow). Use `material.color` only where the 3D scene needs it, never for a swatch.

- [ ] **Step 11: Render the new controls inside the existing accordion**

In `RingDesigner.tsx`, replace the `panels` memo with `const categories = useMemo(() => buildCategories(cfg), [cfg]);`, map over `categories` instead of `panels`, and replace the whole `panel.groups.map(...)` body (`:402-431`) with:

```tsx
{category.groups.map((g) => (
  <ControlGroup key={g.id} group={g} />
))}
```

Delete the bespoke carat slider, band-width slider, ring-size slider and engraving input blocks (`:433-517`) — `categories.ts` now owns all four. Delete `STATIC_PANELS` (`:44-107`) and the `Choice` / `Group` / `Panel` types (`:40-42`).

- [ ] **Step 12: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0.

- [ ] **Step 13: Verify the controls**

Run `npm run dev` at 390×844:

1. Metal shows seven colour circles, not text chips. The selected one has an ink ring; its name prints below in Lora.
2. Stone shows a 3-column grid of nine shape tiles with SVGs. Diamond Type is a two-segment pill with a sliding ink thumb. Carat is a slider with tappable `0.50 ct` … `3.00 ct` ticks — tap `1.50 ct` and the value readout and the stone both change.
3. Head → Prong Pave and Band → Cathedral are switches, not chips. Toggling Cathedral still promotes Basket & Halo to Basket.
4. Engraving is one category containing Inscription, Font and Surprise Stones. The inscription field shows `0/14`; **tap it on an iOS device or simulator and confirm the page does not zoom.**
5. Every swatch, tile, chip, switch, tick and thumb is at least 44px in the Chrome DevTools box model.

- [ ] **Step 14: Commit**

```bash
git add src/lib/designer src/components/designer/controls \
        src/lib/settings/models.ts src/styles/designer.css \
        src/components/builder/RingDesigner.tsx
git commit -m "$(cat <<'EOF'
feat(designer): add typed control primitives and category schema

Adds a render discriminant to the option schema so metals render as
swatches and shapes as tiles. Collapses six panels to five and fixes the
12px engraving input that triggered iOS auto-zoom.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Shell, stage, top bar, and category rail

Replaces the floating accordion stack with the real layout: a stage sized from measured viewport geometry, a top bar that respects the notch, and a static bottom container with the category rail. The sheet does not drag yet — that is Task 5.

**Files:**
- Create: `src/lib/designer/useVisualViewport.ts`
- Create: `src/components/designer/DesignerShell.tsx`, `RingStage.tsx`, `TopBar.tsx`, `CategoryRail.tsx`
- Modify: `src/components/three/RingScene.tsx` (add `CameraReset`, one prop)
- Modify: `src/components/three/RingViewer.tsx` (pass the new prop through)
- Modify: `src/components/builder/CustomRingBuilder.tsx` (render `DesignerShell`)

**Interfaces:**
- Consumes: `useRingConfig`, `buildCategories`, `ControlGroup` from Tasks 2–3.
- Produces: `useVisualViewport(ref) → { appH: number }` which writes `--app-h`; `<DesignerShell shapeId? carat? />`; `<CategoryRail categories activeId onSelect railRef />`; `SceneProps.recenterSignal?: number`.

- [ ] **Step 1: Create `src/lib/designer/useVisualViewport.ts`**

```ts
"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Publishes the *visual* viewport height as `--app-h` on the shell element.
 *
 * The engraving field lives in a bottom-anchored fixed sheet, so on iOS the keyboard
 * covers it. The conventional fix, `interactiveWidget: "resizes-content"`, shrinks the
 * layout viewport and would resize the WebGL canvas on every focus. Measuring
 * visualViewport instead lets the sheet lift above the keyboard while the stage keeps
 * measuring 100dvh, so the canvas never resizes.
 */
export function useVisualViewport(ref: RefObject<HTMLElement | null>) {
  const [appH, setAppH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const vv = window.visualViewport;

    const measure = () => {
      const h = vv?.height ?? window.innerHeight;
      el.style.setProperty("--app-h", `${Math.round(h)}px`);
      setAppH(h);
    };

    measure();

    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [ref]);

  return { appH };
}
```

- [ ] **Step 2: Add `CameraReset` to `RingScene.tsx`**

`RootState.controls` is typed `THREE.EventDispatcher | null`, which has no `reset()`, so take a ref on `<OrbitControls>` instead and type it with React's `ComponentRef` — that avoids importing `three-stdlib`, which is a transitive drei dependency and not in `package.json`.

Add to the imports:

```tsx
import { useEffect, useRef, type ComponentRef } from "react";
```

Add `recenterSignal?: number` to `SceneProps`. Inside the component, above the `return`:

```tsx
const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

// A touch 3D viewer with no way to undo a bad rotation is a dead end. `reset()` restores
// the camera and target OrbitControls captured on mount, which are the values in the
// <Canvas camera> and <OrbitControls target> props below.
useEffect(() => {
  if (recenterSignal) controlsRef.current?.reset();
}, [recenterSignal]);
```

Add `ref={controlsRef}` to the existing `<OrbitControls>` at `:1985`. Change nothing else in the file.

- [ ] **Step 3: Thread `recenterSignal` through `RingViewer.tsx`**

`RingViewer` already spreads `SceneProps`, so it needs no signature change once `recenterSignal` is on `SceneProps`. Confirm with `grep -n "RingScene {...props}" src/components/three/RingViewer.tsx`.

- [ ] **Step 4: Create `TopBar.tsx`**

```tsx
/* eslint-disable @next/next/no-img-element -- brand mark from /public, sized by CSS */
"use client";

type Props = {
  onRecenter: () => void;
  onShare?: () => void;
};

export default function TopBar({ onRecenter, onShare }: Props) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-line/40 bg-sand-200/70 px-3 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "52px" }}
    >
      <img src="/brand/casale-logo.webp" alt="Casale Jewelers" className="h-6 w-auto" />

      <div className="flex items-center">
        <button
          type="button"
          onClick={onRecenter}
          aria-label="Recentre the view"
          className="grid size-11 place-items-center rounded-md text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 4a8 8 0 1 1-8 8" />
            <path d="M4 4v5h5" />
          </svg>
        </button>

        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share this design"
            className="grid size-11 place-items-center rounded-md text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15V3m0 0L8 7m4-4l4 4" />
              <path d="M4 14v5a2 2 0 002 2h12a2 2 0 002-2v-5" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create `RingStage.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import RingViewer from "@/components/three/RingViewer";
import type { SceneProps } from "@/components/three/RingScene";

const HINT_KEY = "designer-rotate-hint-seen";

/**
 * The canvas is transparent, so the studio sweep behind it shows through instead of a
 * colour being drawn in WebGL — the same arrangement the vendor's `.wrapper` rule uses.
 *
 * Height comes from --app-h minus --peek-h, both px values written from JS. It is
 * deliberately independent of the sheet's live drag position: resizing a WebGL canvas
 * mid-gesture drops frames.
 */
export default function RingStage({
  describeRing,
  ...scene
}: SceneProps & { describeRing: string }) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(HINT_KEY)) setShowHint(true);
  }, []);

  function dismissHint() {
    if (!showHint) return;
    sessionStorage.setItem(HINT_KEY, "1");
    setShowHint(false);
  }

  return (
    <div
      className="relative shrink-0"
      style={{ height: "calc(var(--app-h) - var(--peek-h))" }}
      onPointerDown={dismissHint}
    >
      <div className="ring-stage-bg absolute inset-0" />

      {/*
        `describeRing` is destructured out above and never spread into RingViewer — it is
        not part of SceneProps, and forwarding it would be a type error.
      */}
      <div className="absolute inset-0" role="img" aria-label={`3D preview: ${describeRing}`}>
        <RingViewer {...scene} />
      </div>

      {showHint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[13px] text-ink-600 motion-safe:animate-pulse">
          Drag to rotate · pinch to zoom
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create `CategoryRail.tsx`**

```tsx
"use client";

import type { RefObject } from "react";
import type { Category } from "@/lib/designer/types";

type Props = {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  railRef?: RefObject<HTMLDivElement | null>;
};

/**
 * A real tablist: arrow keys move between categories, and the active tab is the only
 * place champagne appears besides the primary CTA.
 */
export default function CategoryRail({ categories, activeId, onSelect, railRef }: Props) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = categories.findIndex((c) => c.id === activeId);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(categories[(i + 1) % categories.length].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(categories[(i - 1 + categories.length) % categories.length].id);
    }
  }

  return (
    <div ref={railRef} className="border-b border-line/60">
      <div
        role="tablist"
        aria-label="Ring options"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto px-2 [scroll-padding-inline:0.5rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              role="tab"
              id={`tab-${c.id}`}
              aria-selected={active}
              aria-controls={`panel-${c.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(c.id)}
              className={`relative flex min-h-[52px] shrink-0 items-center gap-1.5 px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500 ${
                active ? "text-ink-900" : "text-ink-600"
              }`}
            >
              <span aria-hidden className={active ? "text-champagne-500" : "text-ink-400"}>
                {c.icon}
              </span>
              {c.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-champagne-500"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `DesignerShell.tsx`**

The bottom container is static here — fixed at peek height, no drag. Task 5 replaces this container with `OptionSheet`.

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { localModelUrl } from "@/lib/settings/models";
import { prongTipModel } from "@/lib/settings/prongs";
import { buildCategories } from "@/lib/designer/categories";
import { useRingConfig, type RingConfigInit } from "@/lib/designer/useRingConfig";
import { useVisualViewport } from "@/lib/designer/useVisualViewport";
import ControlGroup from "./controls/ControlGroup";
import CategoryRail from "./CategoryRail";
import RingStage from "./RingStage";
import TopBar from "./TopBar";

export default function DesignerShell({ shapeId, carat }: RingConfigInit) {
  const rootRef = useRef<HTMLDivElement>(null);
  useVisualViewport(rootRef);

  const cfg = useRingConfig({ shapeId, carat });
  const categories = useMemo(() => buildCategories(cfg), [cfg]);

  const [activeId, setActiveId] = useState(categories[0].id);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  const { stone, metal, prongMetal, value, angles, activeProngCount } = cfg;

  // Also reused by the live region in Task 9.
  const describeRing =
    `${metal.uiValue}, ${value.carat.toFixed(2)} carat ${stone.name}, ` +
    `${value.basketHalo} head, size ${value.ringSize.toFixed(2)}`;

  return (
    <div ref={rootRef} className="designer-root flex flex-col">
      <TopBar onRecenter={() => setRecenterSignal((n) => n + 1)} />

      <RingStage
        describeRing={describeRing}
        stone={stone}
        stoneModel={localModelUrl(stone.glbUrl)}
        carat={value.carat}
        metalColor={metal.material.color}
        ringSize={value.ringSize}
        bandWidthMm={value.bandWidth}
        prongAngles={angles}
        prongCountType={activeProngCount}
        prongTipModel={prongTipModel(value.prongTip)}
        prongTipId={value.prongTip}
        prongMetalColor={prongMetal.material.color}
        prongPave={value.prongPave}
        basketHalo={value.basketHalo}
        cathedral={value.cathedral}
        bandStyle={value.bandStyle}
        bandFit={value.bandFit}
        engravingText={value.engravingText}
        engravingFont={value.engravingFont}
        surpriseStones={value.surpriseStones}
        bandPave={value.bandPave}
        bandPaveLength={value.bandPaveLength}
        recenterSignal={recenterSignal}
      />

      {/* Static placeholder for the sheet. Task 5 replaces this whole element. */}
      <div
        className="flex min-h-0 shrink-0 flex-col rounded-t-sheet bg-sand-50 shadow-sheet"
        style={{ height: "var(--peek-h)" }}
      >
        <CategoryRail
          categories={categories}
          activeId={activeId}
          onSelect={setActiveId}
        />

        <div
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="min-h-0 flex-1 divide-y divide-line/50 overflow-y-auto px-4 [overscroll-behavior:contain]"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {active.groups.map((g) => (
            <ControlGroup key={g.id} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

Add a `--peek-h` definition to `.designer-root` in `designer.css` so it resolves before Task 5's JS takes over — replace the `--peek-h: 320px;` fallback with `--peek-h: clamp(240px, calc(var(--app-h) * 0.38), 420px);`.

- [ ] **Step 8: Point `CustomRingBuilder` at the shell**

Replace the `<RingDesigner .../>` line (`:26`) with `<DesignerShell shapeId={picked.shapeId} carat={picked.carat} />` and update the import. Leave the commented-out wizard and loading blocks exactly as they are.

- [ ] **Step 9: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0.

- [ ] **Step 10: Verify the layout**

Run `npm run dev` at 390×844:

1. The ring occupies the space above the panel and is **never covered** by it.
2. The top bar shows the logo and a recentre button; rotate the ring by dragging, tap recentre, and the camera returns to its opening framing.
3. The rail scrolls horizontally through Metal / Stone / Head / Band / Engraving. The active tab has a champagne underline. Tapping switches the panel content.
4. Focus the rail with Tab, then press ArrowRight / ArrowLeft — the active category moves and only the active tab is tabbable.
5. "Drag to rotate · pinch to zoom" appears on first load and disappears on first touch of the stage; reload in the same tab and it stays gone.
6. In DevTools, add `env(safe-area-inset-*)` emulation (or test on an iPhone): nothing sits under the notch or the home indicator.
7. Tap the engraving field — the panel content scrolls and the field is reachable above the keyboard. Confirm `--app-h` shrinks in the computed styles of `.designer-root` and the canvas element's height does **not** change.

- [ ] **Step 11: Commit**

```bash
git add src/lib/designer/useVisualViewport.ts src/components/designer \
        src/components/three/RingScene.tsx src/styles/designer.css \
        src/components/builder/CustomRingBuilder.tsx
git commit -m "$(cat <<'EOF'
feat(designer): add mobile shell with stage, top bar, and category rail

The ring is no longer occluded by its own controls. Adds visual-viewport
measurement so the keyboard lifts the panel without resizing the canvas,
and a camera recentre so a bad rotation is recoverable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: The draggable option sheet

Turns the static bottom container into a three-state sheet with drag, flick, and keyboard control.

**Files:**
- Create: `src/components/designer/OptionSheet.tsx`
- Modify: `src/components/designer/DesignerShell.tsx` (swap the static container for `OptionSheet`)
- Modify: `src/styles/designer.css` (sheet positioning and transition)

**Interfaces:**
- Consumes: `CategoryRail`, `ControlGroup`, `Category`.
- Produces: `<OptionSheet categories activeId onSelect footer? />`.

- [ ] **Step 1: Add sheet CSS to `designer.css`**

```css
/*
 * The sheet is always its full height and slid down by --sheet-y, so only the wanted
 * amount shows. JS owns all four geometry values in px; CSS just consumes them. That
 * keeps the calc() chains resolvable and means the canvas height (which reads --peek-h,
 * a constant) is unaffected by the live drag position.
 */
.designer-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  height: var(--sheet-full-h);
  transform: translate3d(0, var(--sheet-y), 0);
  transition: transform 320ms var(--ease-sheet);
  will-change: transform;
}

.designer-sheet[data-dragging="true"] {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .designer-sheet {
    transition-duration: 0ms;
  }
}
```

- [ ] **Step 2: Create `OptionSheet.tsx`**

```tsx
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Category } from "@/lib/designer/types";
import CategoryRail from "./CategoryRail";
import ControlGroup from "./controls/ControlGroup";

const SNAPS = ["collapsed", "peek", "full"] as const;
type Snap = (typeof SNAPS)[number];

/** Past this much travel a drag that ends short of the next snap still commits to it. */
const FLICK_VELOCITY = 0.5; // px per ms

type Props = {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  footer?: ReactNode;
};

export default function OptionSheet({ categories, activeId, onSelect, footer }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [dragging, setDragging] = useState(false);

  // Geometry, all px. Recomputed when the visual viewport or the rail resizes.
  const geo = useRef({ railH: 76, peekH: 320, fullH: 480 });
  const drag = useRef({ startY: 0, startOffset: 0, lastY: 0, lastT: 0, v: 0 });

  const offsetFor = useCallback((s: Snap) => {
    const { railH, peekH, fullH } = geo.current;
    const visible = s === "collapsed" ? railH : s === "peek" ? peekH : fullH;
    return Math.max(0, fullH - visible);
  }, []);

  const applyOffset = useCallback((y: number) => {
    sheetRef.current?.style.setProperty("--sheet-y", `${Math.round(y)}px`);
  }, []);

  /** Measures the shell and the rail, publishes the px vars, and re-snaps. */
  const measure = useCallback(() => {
    const sheet = sheetRef.current;
    const root = sheet?.closest<HTMLElement>(".designer-root");
    if (!sheet || !root) return;

    const appH =
      parseFloat(getComputedStyle(root).getPropertyValue("--app-h")) ||
      window.innerHeight;

    const railH = railRef.current?.offsetHeight ?? 76;
    const peekH = Math.min(420, Math.max(240, appH * 0.38));
    const fullH = Math.max(peekH, appH - 88);

    geo.current = { railH, peekH, fullH };
    root.style.setProperty("--peek-h", `${Math.round(peekH)}px`);
    root.style.setProperty("--rail-h", `${Math.round(railH)}px`);
    root.style.setProperty("--sheet-full-h", `${Math.round(fullH)}px`);
    applyOffset(offsetFor(snap));
  }, [applyOffset, offsetFor, snap]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    const rail = railRef.current;
    const ro = rail ? new ResizeObserver(measure) : null;
    if (rail && ro) ro.observe(rail);

    return () => {
      vv?.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      ro?.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    if (!dragging) applyOffset(offsetFor(snap));
  }, [snap, dragging, applyOffset, offsetFor]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      startY: e.clientY,
      startOffset: offsetFor(snap),
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
    };
    setDragging(true);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const d = drag.current;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;

    const { railH, fullH } = geo.current;
    const next = Math.min(
      Math.max(0, d.startOffset + (e.clientY - d.startY)),
      fullH - railH,
    );
    applyOffset(next);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);

    const d = drag.current;
    const { railH, fullH } = geo.current;
    const landed = Math.min(
      Math.max(0, d.startOffset + (d.lastY - d.startY)),
      fullH - railH,
    );

    // Down is +y, and a larger offset means less sheet showing — so a downward flick
    // (v > 0) should commit to the next *smaller* state.
    const ordered = [...SNAPS];
    if (Math.abs(d.v) > FLICK_VELOCITY) {
      const i = ordered.indexOf(snap);
      const dir = d.v > 0 ? -1 : 1;
      setSnap(ordered[Math.min(ordered.length - 1, Math.max(0, i + dir))]);
      return;
    }

    let best = ordered[0];
    let bestDist = Infinity;
    for (const s of ordered) {
      const dist = Math.abs(offsetFor(s) - landed);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    setSnap(best);
  }

  function onHandleKeyDown(e: React.KeyboardEvent) {
    const i = SNAPS.indexOf(snap);
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSnap(SNAPS[Math.min(SNAPS.length - 1, i + 1)]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSnap(SNAPS[Math.max(0, i - 1)]);
    }
  }

  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  return (
    <div
      ref={sheetRef}
      className="designer-sheet flex flex-col rounded-t-sheet bg-sand-50 shadow-sheet"
      data-dragging={dragging}
    >
      {/*
        Drag binds to the handle and rail strip only. Binding it to the whole sheet would
        fight the body's scroll container at the `full` state.
      */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 [touch-action:none]"
      >
        <button
          type="button"
          aria-label={
            snap === "full" ? "Collapse options" : "Expand options"
          }
          aria-expanded={snap !== "collapsed"}
          onKeyDown={onHandleKeyDown}
          onClick={() => setSnap(snap === "full" ? "peek" : "full")}
          className="grid h-11 w-full place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-sand-300" />
        </button>

        <CategoryRail
          categories={categories}
          activeId={activeId}
          onSelect={onSelect}
          railRef={railRef}
        />
      </div>

      {/*
        Scrollable only at `full`. At `peek` a vertical swipe on the body should drag the
        sheet rather than scroll — which is the behaviour people already expect.
      */}
      <div
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
        className={`min-h-0 flex-1 divide-y divide-line/50 px-4 [overscroll-behavior:contain] ${
          snap === "full" ? "overflow-y-auto [touch-action:pan-y]" : "overflow-hidden"
        }`}
      >
        {active.groups.map((g) => (
          <ControlGroup key={g.id} group={g} />
        ))}
      </div>

      {footer && (
        <div
          className="shrink-0 border-t border-line/60 px-4 pt-3"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Swap the static container for the sheet**

In `DesignerShell.tsx`, delete the static bottom `<div>` from Task 4 Step 7 (the one with `style={{ height: "var(--peek-h)" }}`) and its `CategoryRail` / `tabpanel` children, and replace with:

```tsx
<OptionSheet categories={categories} activeId={activeId} onSelect={setActiveId} />
```

The root element also needs `relative` for the absolutely-positioned sheet — change `className="designer-root flex flex-col"` to `className="designer-root relative flex flex-col"`. Remove the now-unused `CategoryRail` and `ControlGroup` imports.

- [ ] **Step 4: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0.

- [ ] **Step 5: Verify the gestures**

Run `npm run dev` at 390×844 with touch emulation on:

1. The sheet opens at `peek` — rail plus the first control visible.
2. Drag the handle down slowly: it follows your finger, then settles to `collapsed` (rail only) and the **whole ring is visible**.
3. Drag up slowly past halfway: settles to `full`.
4. Flick down fast from `full`: lands on `peek`, not `collapsed` — one state per flick.
5. Flick up fast from `collapsed`: lands on `peek`.
6. At `full`, swipe on the control area: content scrolls and the sheet stays put. At `peek`, swipe on the control area: nothing scrolls.
7. Tap the handle: toggles `peek` ⇄ `full`.
8. Tab to the handle, press ArrowUp / ArrowDown: cycles all three states. The sheet is never drag-only.
9. Watch the canvas element's height in DevTools while dragging: it must **not** change.
10. Enable `prefers-reduced-motion: reduce` in DevTools rendering: state changes are instant, no slide.
11. Rotate to landscape (844×390): geometry re-measures and the sheet still reaches all three states.

- [ ] **Step 6: Commit**

```bash
git add src/components/designer/OptionSheet.tsx \
        src/components/designer/DesignerShell.tsx src/styles/designer.css
git commit -m "$(cat <<'EOF'
feat(designer): add draggable option sheet with three snap states

Collapsed reveals the whole ring, which the accordion stack had no way to
do. JS owns sheet geometry in px so the canvas never resizes mid-drag.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Review sheet with still capture

Gives the flow an ending: a full-height dialog summarising every selection over a still of the ring.

**Files:**
- Create: `src/components/designer/ReviewSheet.tsx`
- Modify: `src/components/three/RingScene.tsx` (capture signal)
- Modify: `src/components/designer/DesignerShell.tsx` (CTA in the sheet footer, dialog state)

**Interfaces:**
- Consumes: `Category[]`, `RingConfig`.
- Produces: `<ReviewSheet open categories imageUrl onClose />`; `SceneProps.captureSignal?: number` and `SceneProps.onCapture?: (dataUrl: string) => void`.

- [ ] **Step 1: Add the capture signal to `RingScene.tsx`**

Two WebGL contexts on a phone risks a lost context, so the review sheet shows a still rather than a second canvas. Rendering and reading in the same frame avoids paying for `preserveDrawingBuffer` on every frame of the main scene.

Add `captureSignal?: number` and `onCapture?: (dataUrl: string) => void` to `SceneProps`. Add this component in the file:

```tsx
/**
 * Reads the canvas as a PNG. `toDataURL` on a WebGL canvas returns a blank image unless
 * the drawing buffer still holds the frame, so render explicitly and read synchronously
 * in the same task — that keeps `preserveDrawingBuffer` off for the main render loop.
 */
function CanvasCapture({
  signal,
  onCapture,
}: {
  signal?: number;
  onCapture?: (dataUrl: string) => void;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (!signal || !onCapture) return;
    gl.render(scene, camera);
    onCapture(gl.domElement.toDataURL("image/png"));
  }, [signal, onCapture, gl, scene, camera]);

  return null;
}
```

Render `<CanvasCapture signal={captureSignal} onCapture={onCapture} />` as a direct child of `<Canvas>`, after `<OrbitControls>`. `useThree` and `useEffect` are already imported in this file — confirm with `grep -n "useThree\|useEffect" src/components/three/RingScene.tsx`.

- [ ] **Step 2: Create `ReviewSheet.tsx`**

```tsx
/* eslint-disable @next/next/no-img-element -- a runtime canvas data: URL, not a static asset */
"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@/lib/designer/types";

type Props = {
  open: boolean;
  categories: Category[];
  imageUrl: string | null;
  onClose: () => void;
  onShare?: () => void;
  shareLabel?: string;
};

/** Renders a control's current selection as display text for the summary. */
function readValue(c: Category["groups"][number]["control"]): string {
  switch (c.kind) {
    case "swatch":
    case "shape":
    case "chip":
    case "segmented":
      return c.options.find((o) => o.id === c.value)?.label ?? "—";
    case "switch":
      return c.value ? "Yes" : "No";
    case "range":
      return c.format(c.value);
    case "text":
      return c.value.trim() || "None";
  }
}

export default function ReviewSheet({
  open,
  categories,
  imageUrl,
  onClose,
  onShare,
  shareLabel = "Copy design link",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap: a dialog the keyboard can escape into a hidden background is worse
      // than no dialog.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreTo.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review your ring"
      ref={panelRef}
      tabIndex={-1}
      className="absolute inset-0 z-30 flex flex-col bg-sand-50"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex min-h-[52px] shrink-0 items-center justify-between border-b border-line/60 px-3">
        <h2 className="font-serif text-[17px] text-ink-900">Your ring</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close review"
          className="grid size-11 place-items-center rounded-md text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Your ring as configured"
            className="mx-auto block max-h-[38vh] w-auto"
          />
        )}

        <dl className="px-4 pb-4">
          {categories.map((c) => (
            <div key={c.id} className="border-t border-line/50 py-3 first:border-t-0">
              <h3 className="font-serif text-[15px] text-ink-900">{c.label}</h3>
              {c.groups.map((g) => (
                <div key={g.id} className="mt-2 flex items-baseline justify-between gap-4">
                  <dt className="text-[13px] text-ink-600">{g.label}</dt>
                  <dd className="font-serif text-[15px] text-ink-900">
                    {readValue(g.control)}
                  </dd>
                </div>
              ))}
            </div>
          ))}
        </dl>
      </div>

      <div
        className="shrink-0 space-y-2 border-t border-line/60 px-4 pt-3"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          className="min-h-12 w-full rounded-md bg-champagne-500 text-[15px] text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
        >
          Contact a jeweler
        </button>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="min-h-12 w-full rounded-md border border-line text-[15px] text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
          >
            {shareLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the CTA into `DesignerShell`**

Add `useCallback` to the React import — Task 4 imported only `useMemo`, `useRef`, `useState`.
Then add state and pass the capture props through to `RingStage`:

```tsx
const [reviewOpen, setReviewOpen] = useState(false);
const [captureSignal, setCaptureSignal] = useState(0);
const [shot, setShot] = useState<string | null>(null);

const openReview = useCallback(() => {
  setShot(null);
  setCaptureSignal((n) => n + 1);
  setReviewOpen(true);
}, []);
```

Add `captureSignal={captureSignal}` and `onCapture={setShot}` to the `RingStage` props, give `OptionSheet` a footer, and render the dialog:

```tsx
<OptionSheet
  categories={categories}
  activeId={activeId}
  onSelect={setActiveId}
  footer={
    <button
      type="button"
      onClick={openReview}
      className="min-h-12 w-full rounded-md bg-champagne-500 text-[15px] text-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
    >
      Review your ring
    </button>
  }
/>

<ReviewSheet
  open={reviewOpen}
  categories={categories}
  imageUrl={shot}
  onClose={() => setReviewOpen(false)}
/>
```

- [ ] **Step 4: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0.

- [ ] **Step 5: Verify the review flow**

Run `npm run dev` at 390×844:

1. "Review your ring" is pinned at the bottom of the sheet in champagne and clears the home indicator.
2. Configure something distinctive — Emerald, 2.50 ct, 14K Rose, Cathedral on, `FOREVER` engraved — then tap Review.
3. The still shows **your** ring, correctly oriented, not a blank or black rectangle. If it is blank, the render-then-read ordering in Step 1 is wrong.
4. Every one of the nineteen groups appears with the right value. Switches read Yes/No, carat reads `2.50 ct`, engraving reads `FOREVER`.
5. Press Escape: it closes and focus returns to the "Review your ring" button.
6. Reopen, then Tab repeatedly: focus cycles inside the dialog and never reaches the sheet behind it.
7. Rotate the ring, reopen Review: the still reflects the new angle.

- [ ] **Step 6: Commit**

```bash
git add src/components/designer/ReviewSheet.tsx \
        src/components/designer/DesignerShell.tsx \
        src/components/three/RingScene.tsx
git commit -m "$(cat <<'EOF'
feat(designer): add review sheet with canvas still capture

Renders and reads the canvas in one frame so the summary shows a real
still without a second WebGL context or preserveDrawingBuffer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Shareable design link *(cuttable)*

The spec flags this as beyond the agreed CTA scope. **If it was cut, skip this task entirely** and remove the `onShare` prop from `TopBar` and `ReviewSheet` along with the `shareLabel` prop.

**Files:**
- Create: `src/lib/designer/shareCodec.ts`
- Modify: `src/lib/designer/useRingConfig.ts` (hydrate from the hash)
- Modify: `src/components/designer/DesignerShell.tsx` (share handler)

**Interfaces:**
- Produces: `encodeConfig(v: RingValue): string`, `decodeConfig(hash: string): Partial<RingValue> | null`.

- [ ] **Step 1: Create `src/lib/designer/shareCodec.ts`**

```ts
import type { RingValue } from "./types";

const PREFIX = "#c=";

/**
 * Encodes the config into a URL hash. Deliberately lossy-tolerant: decode returns a
 * Partial and the hook merges it over defaults, so a link made by an older build never
 * throws — it just fills in what it recognises.
 */
export function encodeConfig(v: RingValue): string {
  const json = JSON.stringify(v);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeConfig(hash: string): Partial<RingValue> | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const b64 = hash.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object" ? (parsed as Partial<RingValue>) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Hydrate from the hash in `useRingConfig`**

The initialiser cannot read `location` — it runs during SSR too. Hydrate in an effect after mount instead, so the server and first client render agree:

```ts
// A shared link fills in what it recognises over the defaults; an unparseable or
// older-format hash is ignored rather than throwing.
useEffect(() => {
  const patchFromUrl = decodeConfig(window.location.hash);
  if (patchFromUrl) setValue((prev) => ({ ...prev, ...patchFromUrl }));
}, []);
```

- [ ] **Step 3: Add the share handler to `DesignerShell`**

```tsx
const [shareLabel, setShareLabel] = useState("Copy design link");

const share = useCallback(async () => {
  const url = `${window.location.origin}${window.location.pathname}${encodeConfig(value)}`;
  try {
    await navigator.clipboard.writeText(url);
    setShareLabel("Link copied");
    window.setTimeout(() => setShareLabel("Copy design link"), 2000);
  } catch {
    // Clipboard is permission-gated and unavailable on insecure origins. Putting the
    // URL in the address bar still leaves the user something they can copy by hand.
    window.location.hash = encodeConfig(value).slice(1);
    setShareLabel("Link in address bar");
    window.setTimeout(() => setShareLabel("Copy design link"), 2000);
  }
}, [value]);
```

Pass `onShare={share}` to `TopBar`, and `onShare={share} shareLabel={shareLabel}` to `ReviewSheet`.

- [ ] **Step 4: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0.

- [ ] **Step 5: Verify round-tripping**

Run `npm run dev`:

1. Configure Emerald, 2.50 ct, 14K Rose, Cathedral on, `FOREVER`. Tap share in the top bar — the label confirms the copy.
2. Paste the URL into a new tab. The ring loads with all five choices applied.
3. Hand-corrupt the hash (delete a few characters mid-string) and reload: the app loads defaults and does **not** throw. Check the console is clean.
4. Load the page with no hash at all: defaults, no console error.

- [ ] **Step 6: Commit**

```bash
git add src/lib/designer/shareCodec.ts src/lib/designer/useRingConfig.ts \
        src/components/designer/DesignerShell.tsx
git commit -m "$(cat <<'EOF'
feat(designer): encode the configuration into a shareable URL hash

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Desktop and tablet layout

At ≥768px the sheet becomes a fixed right-hand panel. Same components, different container — no forked control code.

**Files:**
- Modify: `src/styles/designer.css` (media query)
- Modify: `src/components/designer/OptionSheet.tsx` (disable drag above the breakpoint)
- Modify: `src/components/designer/RingStage.tsx`, `ReviewSheet.tsx` (widths)

**Interfaces:** no new exports.

- [ ] **Step 1: Add the desktop rules to `designer.css`**

```css
@media (min-width: 768px) {
  /* The sheet becomes a static right-hand panel: no transform, no drag. */
  .designer-sheet {
    top: 0;
    left: auto;
    width: 360px;
    height: 100%;
    border-left: 1px solid var(--color-line);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    transform: none;
    transition: none;
  }
}
```

- [ ] **Step 2: Neutralise the drag above the breakpoint**

In `OptionSheet.tsx`, track the breakpoint and skip the gesture and the offset writes when it is wide:

```tsx
const [isWide, setIsWide] = useState(false);

useEffect(() => {
  const mq = window.matchMedia("(min-width: 768px)");
  const sync = () => setIsWide(mq.matches);
  sync();
  mq.addEventListener("change", sync);
  return () => mq.removeEventListener("change", sync);
}, []);
```

Guard `onPointerDown` with `if (isWide) return;`, skip the `applyOffset` calls in `measure` and the snap effect when `isWide`, hide the handle button with `className={isWide ? "hidden" : "grid h-11 w-full …"}`, and make the body always scrollable when wide: `snap === "full" || isWide ? "overflow-y-auto …" : "overflow-hidden"`.

- [ ] **Step 3: Size the stage and the dialog for wide viewports**

In `RingStage.tsx`, the stage takes the full height beside the panel rather than the height above the sheet. The mobile height **must move off the inline `style` and into a custom property** — an inline `height` beats any class, so `md:h-full` could never override it. Replace the wrapper's `className` and `style` with exactly:

```tsx
<div
  className="relative shrink-0 h-[var(--stage-h)] md:h-full md:w-[calc(100%-360px)]"
  style={{ "--stage-h": "calc(var(--app-h) - var(--peek-h))" } as React.CSSProperties}
  onPointerDown={dismissHint}
>
```

Also give `DesignerShell`'s root `md:flex-row` so the stage and panel sit side by side.

In `ReviewSheet.tsx`, make the dialog a centred modal on wide screens: wrap the panel in a backdrop `div` with `className="absolute inset-0 z-30 md:grid md:place-items-center md:bg-ink-900/40"` and give the panel `md:h-auto md:max-h-[85vh] md:w-[640px] md:rounded-lg`.

- [ ] **Step 4: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0.

- [ ] **Step 5: Verify both layouts**

Run `npm run dev` and check each width:

1. **1280×800** — panel is 360px on the right with a hairline left border, no drag handle, rail as tabs at its top, control area scrolls. Stage fills the rest and the ring is centred in it.
2. **768×1024** — same panel layout, nothing clipped or overlapping.
3. **767×1024** — flips back to the bottom sheet; the handle reappears and drag works.
4. Resize slowly across 768 in both directions: no stuck transform, no sheet abandoned mid-screen.
5. At 1280, open Review: it is a centred 640px modal over a dimmed backdrop, not a full-bleed sheet. Escape still closes it and returns focus.

- [ ] **Step 6: Commit**

```bash
git add src/styles/designer.css src/components/designer
git commit -m "$(cat <<'EOF'
feat(designer): adapt the sheet to a right-hand panel at >=768px

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Live region, cleanup, and full verification

Adds the screen-reader announcement, deletes the old designer, and runs the whole matrix.

**Files:**
- Modify: `src/components/designer/DesignerShell.tsx` (live region)
- Delete: `src/components/builder/RingDesigner.tsx`

**Interfaces:** no new exports.

- [ ] **Step 1: Add the announcement region to `DesignerShell`**

A configurator whose only feedback is a 3D render tells a screen-reader user nothing. Debounced so dragging the carat slider does not flood the queue:

```tsx
const [announcement, setAnnouncement] = useState("");

useEffect(() => {
  const t = window.setTimeout(
    () =>
      setAnnouncement(
        `${cfg.metal.uiValue}, ${cfg.value.carat.toFixed(2)} carat ${cfg.stone.name}, ` +
          `${cfg.value.basketHalo} head, size ${cfg.value.ringSize.toFixed(2)}`,
      ),
    400,
  );
  return () => window.clearTimeout(t);
}, [cfg.metal.uiValue, cfg.value.carat, cfg.stone.name, cfg.value.basketHalo, cfg.value.ringSize]);
```

Note this reads the same `describeRing` string that Task 4 already computes and passes to
`RingStage` for its `role="img"` label — so replace the body above with
`setAnnouncement(describeRing)` and depend on `[describeRing]`. One source of truth for how
the ring is described in words.

Render it inside the root:

```tsx
<p role="status" aria-live="polite" className="sr-only">
  {announcement}
</p>
```

- [ ] **Step 2: Delete the old designer**

```bash
git rm src/components/builder/RingDesigner.tsx
```

Confirm nothing references it: `grep -rn "RingDesigner" src/` must print nothing.

- [ ] **Step 3: Confirm no designer code depends on the wizard stylesheet**

```bash
grep -rn "jos-" src/components/designer src/components/three src/lib/designer
```

Expected: no output. `wizard.css` stays loaded for the (still-disabled) wizard, but nothing in the new tree may reach into it.

- [ ] **Step 4: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three exit 0, no warnings about unused files.

- [ ] **Step 5: Run the full verification matrix**

Viewports: **390×844**, **360×640**, **768×1024**, **1280×800**.

At each, confirm:
1. Nothing overflows horizontally; no element is clipped.
2. The ring is visible and rotatable; recentre works.
3. All five categories reachable; all nineteen groups render their intended control.
4. The review sheet opens, shows a correct still, and closes on Escape.

Then, once each:
5. **Keyboard only**, no pointer: Tab from the top of the page and reach the recentre button, the sheet handle, every tab in the rail, every control in the active panel, and the review CTA. Operate the sheet with ArrowUp/ArrowDown and the rail with ArrowLeft/ArrowRight. Open and close Review.
6. **`prefers-reduced-motion: reduce`**: no sheet slide, no segmented-thumb slide, no rotate-hint pulse. Everything still functional.
7. **Contrast**: sample hint text with the DevTools colour picker. All hint and body text must be ink-600 `#56574f` or darker. Any ink-400 `#8a8b82` on text that carries meaning is a defect — it is ~2.6:1.
8. **iOS Safari** (device or simulator, cannot be checked in desktop DevTools): tapping the engraving field does not zoom the page; the sheet lifts clear of the keyboard; nothing sits under the notch or the home indicator; drag-to-rotate does not scroll the page.

- [ ] **Step 6: Commit**

```bash
git add src/components/designer
git commit -m "$(cat <<'EOF'
feat(designer): announce configuration changes and remove RingDesigner

Adds a debounced status region so the configurator is usable without
sight of the 3D render, and deletes the accordion designer the shell
replaced.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

**Spec coverage.** Every spec section maps to a task: tokens/viewport/stylesheet independence → 1; named state and the cathedral coupling → 2; render discriminant, five categories, control specifics, 16px input, 44px targets → 3; visual-viewport hook, stage geometry, top bar, camera reset, rotate hint, safe areas → 4; three snap states, gestures, reduced motion → 5; review sheet and still capture → 6; share link → 7; desktop → 8; live region, contrast audit, cleanup → 9.

**Two items deliberately not their own task.** Accessibility is built into each task (radiogroups in 3, tablist in 4, dialog in 6) rather than deferred to a sweep — bolting on ARIA afterwards is how it ends up wrong. Per-control `focus-visible` styling likewise lands with each control.

**Known unknown for the implementer.** `categories.ts` reads `m.swatchColor ?? m.material.color`. The field name is not verified — Task 3 Step 10 instructs checking `src/lib/settings/types.ts` and `snapshot/colors.json` and using the real name. It is called out rather than guessed silently.

**Fixes applied during self-review.** `RingStage` originally took bare `SceneProps` and gained
`describeRing` in Task 9, which would have spread an unknown prop into `RingViewer` and failed
to typecheck — it now destructures `describeRing` out from the start, and Task 9 reuses the
string rather than recomputing it. The `ReactNode` import in Task 3 would have landed in the
middle of `types.ts`; it is now explicitly directed to the top import block. A hand-written
`RingSetters` mapped type and a `--panel-w` token were both dead on arrival and are gone. Task
2 now enumerates the imports that go unused once the hook owns the state, since lint fails
on them.

**Two ordering traps worth flagging.** Task 6 Step 1 must render *before* reading the canvas, or the still is blank. Task 8 Step 3 must move the stage height into a custom property, because an inline `style` height cannot be overridden by `md:h-full` — the plan states the fix rather than leaving the implementer to discover it.
