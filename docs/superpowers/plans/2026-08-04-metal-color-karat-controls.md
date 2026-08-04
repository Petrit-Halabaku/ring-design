# Metal Colour + Karat Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat seven-metal swatch row with colour-first swatches (Yellow / White / Rose / Platinum) plus a conditional 14K | 18K karat control.

**Architecture:** Keep `metalIdx` as the single source of truth. Pure helpers parse `uiValue` into colour + karat and resolve colour/karat changes back to a metal index. The Metal category exposes two control groups; `SwatchRow` gains a compact (non-scrolling) layout for ≤4 options.

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / existing designer controls (`SwatchRow`, `Segmented`).

**Spec:** `docs/superpowers/specs/2026-08-04-metal-color-karat-controls-design.md`

## Global Constraints

- **No new dependencies.** No new `Control` kind.
- **No test framework.** Verify with `npx tsc --noEmit` and `npm run lint`. Do not add test files.
- **Out of scope:** Prong Metal, wizard, settings API/snapshots, `RingValue` shape.
- **Do not commit** unless the user explicitly asks.
- White vs Platinum: label only (same hex `#B0B0B0`).
- Gold → gold preserves karat; Platinum → gold defaults to **18K**.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/designer/metalSelection.ts` | *create* — parse/resolve colour + karat ↔ `uiValue` / index |
| `src/lib/designer/categories.tsx` | *modify* — Metal category: colour swatch + conditional karat |
| `src/components/designer/controls/SwatchRow.tsx` | *modify* — compact fit layout when few options |

---

### Task 1: Metal selection helpers

**Files:**
- Create: `src/lib/designer/metalSelection.ts`

**Interfaces:**
- Consumes: `MetalColor` from `@/lib/settings/types` (`uiValue`, `backgroundColor`, `description`).
- Produces:
  - `MetalColourId = "Yellow" | "White" | "Rose" | "Platinum"`
  - `MetalKaratId = "14K" | "18K"`
  - `parseMetalUiValue(uiValue: string): { colour: MetalColourId; karat: MetalKaratId | null }`
  - `metalColourOptions(metals: MetalColor[]): SwatchOption[]` — one swatch per colour, hex from a representative metal
  - `resolveMetalByColour(metals, colour, currentUiValue): string` — returns target `uiValue`
  - `resolveMetalByKarat(metals, karat, currentUiValue): string` — returns target `uiValue`

- [x] **Step 1: Create `metalSelection.ts`**
- [x] **Step 2: Typecheck**

---

### Task 2: Compact `SwatchRow` for four colours

**Files:**
- Modify: `src/components/designer/controls/SwatchRow.tsx`

**Interfaces:**
- Consumes: existing `Props`.
- Produces: when `options.length <= 4`, row uses equal flex without horizontal scroll; otherwise keep current scroll behaviour.

- [ ] **Step 1: Update layout**

When `options.length <= 4`:
- Container: `flex gap-2 py-1` (no `-mx-1 overflow-x-auto snap-x`).
- Buttons: `flex-1` (drop `shrink-0 snap-start`), keep `size-11` min touch via min height/width on the button or centered swatch.
- Keep selected label below using `selected.label` (for colour group, labels are Yellow/White/… — categories will pass description via hint; selected line can show colour id OR we pass full description as option label for the active metal's colour only).

Spec wants selected label = metal `description`. Colour options use short labels (Yellow…). Fix in Task 3: keep colour option labels short for aria, and either:
- stop showing `SwatchRow`'s selected `<p>` for colour (hint already shows description), OR
- override: categories still set hint to `metal.description`; hide the redundant selected line when compact.

Preferred: in compact mode, omit the selected-name paragraph (hint already carries `metal.description`). Scroll mode (Prong Metal) keeps the name under the row.

```tsx
const compact = options.length <= 4;
// ...
{!compact && selected && (
  <p className="mt-2 font-serif text-[15px] text-ink-900">{selected.label}</p>
)}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`

---

### Task 3: Wire Metal category groups

**Files:**
- Modify: `src/lib/designer/categories.tsx` (Metal category `groups` only)

**Interfaces:**
- Consumes: helpers from Task 1, `metal`, `settings.metals`, `set.setMetalIdx`.
- Produces: groups `metal-color` (swatch) and conditionally `metal-karat` (segmented).

- [ ] **Step 1: Replace Metal `groups`**

```tsx
import {
  metalColourOptions,
  parseMetalUiValue,
  resolveMetalByColour,
  resolveMetalByKarat,
} from "./metalSelection";

// inside buildCategories, Metal category:
const { colour, karat } = parseMetalUiValue(metal.uiValue);
const colourOptions = metalColourOptions(settings.metals);

groups: [
  {
    id: "metal-color",
    label: "Head & Band Colour",
    hint: metal.description,
    control: {
      kind: "swatch",
      options: colourOptions,
      value: colour,
      onChange: (id) => {
        const uiValue = resolveMetalByColour(
          settings.metals,
          id as import("./metalSelection").MetalColourId,
          metal.uiValue,
        );
        set.setMetalIdx(settings.metals.findIndex((m) => m.uiValue === uiValue));
      },
    },
  },
  ...(karat
    ? [
        {
          id: "metal-karat",
          label: "Karat",
          control: {
            kind: "segmented" as const,
            options: [
              { id: "14K", label: "14K" },
              { id: "18K", label: "18K" },
            ],
            value: karat,
            onChange: (id: string) => {
              const uiValue = resolveMetalByKarat(
                settings.metals,
                id as import("./metalSelection").MetalKaratId,
                metal.uiValue,
              );
              set.setMetalIdx(settings.metals.findIndex((m) => m.uiValue === uiValue));
            },
          },
        },
      ]
    : []),
],
```

Use proper type imports at top of file instead of inline `import()`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`  
Manual: open Metal panel — four swatches fit; karat appears for gold, hides for Platinum; colour/karat map to correct metal; Prong Metal still scrolls.

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Colour-first four swatches | 1, 3 |
| Conditional 14K \| 18K | 3 |
| Fit without horizontal scroll | 2 |
| `metalIdx` unchanged | 3 |
| Gold→gold keep karat; Pt→gold → 18K | 1 |
| Label-only White vs Pt | 1, 3 (hint) |
| Prong Metal unchanged | 2 threshold, 3 scope |
