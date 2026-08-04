# Metal colour + karat controls — design

**Date:** 2026-08-04  
**Scope:** Head & Band Colour in the designer Metal category only. Prong Metal, wizard, and settings API/snapshots are out of scope.

## Why

Metal options are seven flat swatches (`14K`/`18K` × Yellow/White/Rose + Platinum) in one horizontal-scrolling `SwatchRow`. They overflow the options panel and mix colour with karat in a single list that is hard to scan.

## Decision

Colour-first selection: four colour swatches, then a karat control when the colour is gold. State remains a single `metalIdx` into `settings.metals`.

## Behaviour

### Colour group (`metal-color`)

- Options: **Yellow**, **White**, **Rose**, **Platinum**.
- Swatch hexes come from the matching metal’s `backgroundColor` (Yellow `#F4AA3C`, White/Platinum `#B0B0B0`, Rose `#FF8841`).
- White and Platinum share a hex; distinguish by label under the row (and `aria-label`), not a Pt badge.
- Selecting a colour maps to a concrete metal:
  - Gold → gold: keep the current karat.
  - Platinum → gold: default karat to **18K** (matches the configurator default).
  - Any → Platinum: select the Platinum record.
- Selected label under the swatches is the metal’s `description` (e.g. `18K Yellow Gold`, `Platinum`).

### Karat group (`metal-karat`)

- Segmented control: **14K** | **18K**.
- Visible only when the current metal is gold (Yellow / White / Rose).
- Changing karat keeps colour and resolves to the matching `uiValue` (e.g. Yellow + 14K → `14K Yellow`).

### Layout

- Four colour swatches must fit the panel width without horizontal scroll (equal flex or wrap). Prefer a prop or option-count threshold on `SwatchRow` so Prong Metal (Match Band + seven metals) keeps its scroll row.

## Data mapping

Derive colour and karat from `MetalColor.uiValue`:

| `uiValue`   | Colour   | Karat    |
| ----------- | -------- | -------- |
| `14K Yellow` / `18K Yellow` | Yellow | 14K / 18K |
| `14K White` / `18K White`   | White  | 14K / 18K |
| `14K Rose` / `18K Rose`     | Rose   | 14K / 18K |
| `Platinum`                  | Platinum | — |

Helpers live next to category building (e.g. small pure functions in `lib/designer/`), not in the React controls. `onChange` always resolves via `settings.metals.findIndex` on the composed `uiValue`.

## Components

| Piece | Change |
| --- | --- |
| `categories.tsx` Metal category | Replace single swatch group with colour swatch + conditional karat segmented |
| Metal parse/resolve helpers | New small module or colocated helpers |
| `SwatchRow` | Ensure four swatches fit without scroll; keep selected name below |
| `Control` / `Segmented` | Reuse as-is for karat |
| Prong Metal swatch | Unchanged |

## Non-goals

- No new `Control` kind.
- No changes to `RingValue` shape or persistence keys.
- No prong-metal colour/karat split in this pass.
- No visual differentiation beyond label for White vs Platinum.

## Acceptance

1. Metal panel shows four colour swatches that fit without horizontal scroll on the options panel width (mobile and `md` panel).
2. Selecting Yellow/White/Rose shows 14K | 18K; selecting Platinum hides karat.
3. Colour + karat always land on the correct `metalIdx` / `uiValue`.
4. Switching colour among golds preserves karat; leaving Platinum for a gold colour selects **18K** of that colour.
5. Hint / selected copy still reflects the full metal description.
6. Prong Metal keeps its existing scrolling swatch row.
