# Mobile-first ring designer — design

**Date:** 2026-08-03
**Scope:** the 3D ring designer only. The 5-step wizard and the loading interstitial stay
commented out in `CustomRingBuilder.tsx` and are not touched. Site chrome
(`SiteHeader`/`SiteFooter`) stays commented out. `wizard.css` is not restyled.

## Why

`RingDesigner.tsx` is a 528-line file that renders the entire configurator as six accordion
cards absolutely positioned over the canvas. On a phone those cards are
`inset-x-3 bottom-3 h-full overflow-y-auto` (`RingDesigner.tsx:363`) — a full-height scrolling
stack sitting on top of the ring the user is trying to evaluate. Every option is a wrapping
text chip, so a metal colour and a diamond shape look identical. There is no summary, no
ending, and no way to see the ring unobstructed.

Three concrete defects come along with it:

1. **No viewport plumbing.** No `viewport` export, no `dvh`, no `env(safe-area-inset-*)`. On
   iOS Safari the `fixed inset-0` stage (`wizard.css:860`) is clipped by the dynamic toolbar
   and runs under the notch and home indicator.
2. **The engraving input is 12px** (`RingDesigner.tsx:514`). iOS Safari auto-zooms the page on
   focus for any input below 16px.
3. **Positional state keys.** The static panels store answers in
   `selections: Record<string, number>` keyed by grid position — `selections["band-1"]` is
   cathedral, `["band-4"]` is pave length (`RingDesigner.tsx:347-358`). Reordering a group
   silently rewires the 3D scene.

## Decisions

| Decision | Choice |
| --- | --- |
| Mobile control model | Bottom sheet with a horizontal category rail; ring stays visible |
| Look and feel | Refined warm studio — keep the existing sand/ink palette and photographic sweep, rebuild as a token system |
| Ending | "Review your ring" summary sheet |
| Approach | Decompose into components + add a render discriminant to the option schema |
| No new UI dependencies | The sheet is ~80 lines of pointer events; shadcn/vaul/Radix are not worth the graph |

## Architecture

`RingDesigner.tsx` dissolves. Nothing under `three/` or `lib/settings/` changes except one
contained addition to `RingScene` (see *Camera reset*).

```
src/components/designer/
  DesignerShell.tsx        stage + sheet + top bar
  TopBar.tsx               wordmark, recenter view, share
  RingStage.tsx            canvas, backdrop, first-run rotate hint
  OptionSheet.tsx          draggable sheet, snap points
  CategoryRail.tsx         tablist
  ReviewSheet.tsx          summary
  controls/
    ControlGroup.tsx       label + hint + child control
    SwatchRow.tsx  ShapeGrid.tsx  ChipRow.tsx
    Segmented.tsx  Switch.tsx  RangeControl.tsx  TextField.tsx
src/lib/designer/
  useRingConfig.ts         all ring state + derived values
  categories.ts            category / group / control schema
  types.ts
src/styles/designer.css    stage backdrop, sheet motion, slider thumb
```

### State: `useRingConfig`

Replaces the 12 `useState` calls and the `selections` record with named fields:
`metalIdx`, `stoneIdx`, `carat`, `diamondType`, `basketHalo`, `prongCount`, `prongTip`,
`prongPave`, `prongMetalIdx`, `bandStyle`, `cathedral`, `bandPave`, `bandPaveLength`,
`bandFit`, `bandWidth`, `ringSize`, `engravingFont`, `engravingText`, `surpriseStones`.

`diamondType` (Natural / Lab Grown) drives nothing in the 3D scene today — it is a display-only
group in the current build (`RingDesigner.tsx:209-214`) and stays that way. It is held in state
so the review sheet can report it.

This deletes the `key()` / `activeChoice()` / `choose()` index-dispatch ladder
(`RingDesigner.tsx:288-318`) — roughly 40 lines of positional mapping. The cathedral→basket
coupling at `:307-309` becomes an explicit named rule in the hook: setting `cathedral` true
while `basketHalo === "None"` promotes it to `"Basket"`, matching the vendor's own handler.

The hook keeps the existing behaviours: snapshot-seeded first paint with a background
`fetchRingSettings` (`:153-157`), stones filtered to those with local GLBs (`:160-163`), and
prong-count validation against the active shape and carat (`:170-178`).

### Schema: a render discriminant

The current model is `Group = { label, hint, choices: Choice[], selected }` with
`Choice = { label }`. Nothing in it can express "these are metal colours," which is precisely
why everything renders as a text chip. Adding a discriminant is the unlock:

```ts
type Control =
  | { kind: "swatch";    options: { id: string; label: string; hex: string }[] }
  | { kind: "shape";     options: { id: string; label: string; svg: string }[] }
  | { kind: "chip";      options: { id: string; label: string }[] }
  | { kind: "segmented"; options: { id: string; label: string }[] }
  | { kind: "switch" }
  | { kind: "range";     min: number; max: number; step: number;
                         format: (n: number) => string; presets?: number[] }
  | { kind: "text";      maxLength: number }

type ControlGroup = {
  id: string; label: string; hint?: string;
  control: Control;
  value: unknown;
  onChange: (next: unknown) => void;
};

type Category = { id: string; label: string; icon: ReactNode; groups: ControlGroup[] };
```

Both inputs already exist in the repo: metals carry a real hex (`metal.material.color`) and
the nine diamond shapes have SVGs in `public/shapes/`.

### Categories

Six panels collapse to five. "More" was a junk drawer; its engraving font, engraving text and
surprise stones belong together.

| Category | Groups → control |
| --- | --- |
| Metal | Head & Band Colour → **swatch** (7 metals) |
| Stone | Shape → **shape** (9); Type Natural/Lab → **segmented**; Carat → **range** |
| Head | Basket & Halo → **chip** (5); Prong Count → **segmented** (shape-dependent, 2–3); Prong Tips → **chip** (4); Prong Pave → **switch**; Prong Metal → **swatch** with a leading "Match band" tile |
| Band | Style → **segmented** (2); Cathedral → **switch**; Pave Style → **segmented** (2); Pave Length → **chip** (5); Fit → **segmented** (2); Width → **range**; Ring Size → **range** |
| Engraving | Font → **segmented** (2); Text → **text** (14 max); Surprise Stones → **switch** |

Counts verified against `basketHalo.ts:15-20` (5), `prongs.ts:152-155` (4),
`bandGeometry.ts:26-27` (2, 2), `bandPave.ts:17` (5), `colors.json` (7),
`public/shapes/` (9).

### Severing the wizard-stylesheet dependency

`RingViewer.tsx:17` renders its spinner with `className="jos-loading-spinner"` — a wizard
class. The wizard is out of scope but its stylesheet stays loaded, so the designer should not
reach into it. The designer gets its own spinner, and `.ring-stage-bg` and
`.customizer-container` move from `wizard.css:847-868` into `designer.css`.

## The mobile shell

### Viewport

`layout.tsx` gains:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e4e5de",
};
```

Deliberately no `maximumScale` or `userScalable: false` — pinch-zoom stays available, and
jewellery is exactly what people zoom into.

### Keyboard handling

The engraving field sits in a bottom-anchored `fixed` sheet, so on iOS the keyboard covers it.
The conventional fix, `interactiveWidget: "resizes-content"`, shrinks the layout viewport and
would resize the WebGL canvas on every focus.

Instead: a `useVisualViewport` hook writes `visualViewport.height` into a `--app-h` CSS
variable. Sheet snap points measure against `--app-h`, so the sheet lifts above the keyboard;
the stage measures `100dvh`, so the canvas never resizes.

### Sheet states

| State | Height | Shows |
| --- | --- | --- |
| `collapsed` | `76px + env(safe-area-inset-bottom)` | Rail only — ring fully unobstructed |
| `peek` | `--peek-h`, defined as `clamp(240px, calc(var(--app-h) * 0.38), 420px)` | Rail + the active category's first control |
| `full` | `calc(var(--app-h) - 88px)` | Everything; body scrolls |

The canvas is always sized `calc(var(--app-h) - var(--peek-h))` regardless of sheet state.
`--peek-h` is the computed peek constant, never the live dragged height — so dragging the sheet
never resizes the canvas. Collapsing reveals more backdrop below the ring rather than
re-laying out the scene.

### Gestures

Pointer Events bind to the handle and rail strip only, leaving the body's scroll intact.
`setPointerCapture`, `translate3d` during drag, release snaps to the nearest state with
velocity bias (>0.5 px/ms continues in the flick direction). Transition
`transform 320ms cubic-bezier(.32,.72,0,1)` when not dragging, `0ms` under
`prefers-reduced-motion`.

The body is `overflow: hidden` at `peek` and `overflow-y: auto; overscroll-behavior: contain`
at `full`, so a vertical swipe on the body drags the sheet at peek and scrolls content at full.

### Top bar

52px tall, `padding-top: env(safe-area-inset-top)`, translucent with backdrop-blur over the
stage. Casale wordmark left; recenter-view and share right.

### Camera reset

`RingScene` gets one addition: a `<CameraReset trigger={n} />` child reading
`useThree().controls` — already available because `OrbitControls` has `makeDefault`
(`RingScene.tsx:1986`) — that lerps back to the default position. About 12 lines plus one
prop, inside an otherwise-untouched 1996-line file. Justified because a touch 3D viewer with
no way to undo a bad rotation is a dead end, and there is currently no escape.

### First-run hint

A "drag to rotate" caption with a subtle arc animation over the stage, dismissed on first
`pointerdown`, remembered in `sessionStorage`. Hidden entirely under
`prefers-reduced-motion`.

### Safe areas and touch targets

Sheet bottom padding `max(16px, env(safe-area-inset-bottom))`, with the sticky CTA above it.
The rail scrolls horizontally with `scroll-padding-inline` and edge-fade masks. Every
interactive element is at least 44×44, including range thumbs: a 28px visual thumb inside a
44px hit area via `::-webkit-slider-thumb`. The current native sliders (`RingDesigner.tsx:443`)
are roughly 16px.

## Tokens

A `@theme` block in `globals.css` (Tailwind v4), built from colours already present in the
vendor CSS so nothing looks foreign:

- **Sand** `#f7f7f4 / #eeeeea / #e4e5de / #d5d6cd` — `#e4e5de` is the existing stage colour
  (`wizard.css:10`). Hairline `#cfd0c7`.
- **Ink** `#1c1d1e` (the vendor's near-black, `wizard.css:76`) with `#56574f` and `#8a8b82`.
- **Champagne** `#a3854f`, plus `#f0e7d6`.
- Radii 8 / 12 / 18 / 24px. Two warm-tinted shadows using `rgb(28 29 30 / .08)`, never pure
  black. One sheet easing curve.

**Selection rule:** selection state is always ink. Champagne is reserved for the primary CTA
and the rail's active indicator. With 19 option groups on one screen, an unrestricted accent
becomes confetti.

**Type.** Lora for the ring title, category headings, and all numeric readouts — serif
numerals make carat and ring size read like a jeweller's spec rather than a form. Roboto for
labels and body. Floor of 13px: labels 15px, hints 13px, values 15px Lora, rail 13px. The
current build uses 11px hints (`:410`) and 12px values (`:439`).

## Controls worth specifying

- **SwatchRow** — 44px circles filled with the API hex, horizontally scrolling, with the
  selected metal's name below the row rather than a label per swatch. Selected is a 2px ink
  ring at 3px offset. `role="radiogroup"`, each swatch `aria-label`ed with its metal name.
- **ShapeGrid** — 3-column tiles, 40px SVG plus a 13px name, `min-height: 76px`.
- **RangeControl** — Lora value readout right-aligned, plus tappable preset ticks below the
  track (carat 0.5 / 1 / 1.5 / 2 / 3; ring size 4 / 6 / 8 / 10 / 12). Dragging to exactly
  1.00 ct on a phone is miserable; the ticks are the fast path.
- **TextField** — 16px font (fixes the iOS auto-zoom noted above), a `6/14` counter,
  `autoCapitalize="characters"`, `enterKeyHint="done"`.
- **Segmented** — full-width pill track with a sliding ink thumb, equal-width segments.
- **Switch** — 52×32 track.
- **ChipRow** — wrapping chips, 44px minimum height, 13px text.

## Review sheet

Full-height over the stage. `role="dialog" aria-modal="true"`, focus-trapped, Esc to close,
focus restored on exit.

It shows a **still capture** of the ring rather than mounting a second canvas — two WebGL
contexts on a phone risks a lost context. The capture avoids paying for
`preserveDrawingBuffer` by calling `gl.render(scene, camera)` and then `toDataURL()`
synchronously in the same frame, driven by a signal prop.

Body is a grouped definition list of every selection, values in Lora. Footer has "Contact a
jeweler" (champagne) and "Copy design link".

**Copy design link** encodes the config into a URL hash that the app hydrates on load — about
30 lines, no backend. It is an addition beyond the agreed CTA scope and is cuttable; without
it the review sheet is read-only and the top-bar share button goes away too.

## Desktop and tablet (≥768px)

Same components, different container. The sheet becomes a fixed 360px right-hand panel with
the rail as tabs at its top; the stage takes `calc(100vw - 360px)`; the review sheet becomes a
centred 640px modal. No forked control code.

## Accessibility

- Rail is a real `tablist` / `tab` / `tabpanel` with arrow-key navigation and
  `aria-selected` / `aria-controls`.
- Option groups are `radiogroup` / `radio` with `aria-checked`.
- The sheet handle is a focusable button with `aria-expanded`, and Up/Down cycles states, so
  the sheet is never drag-only.
- Champagne `:focus-visible` ring at 2px offset.
- The canvas carries a descriptive `aria-label`; a debounced `role="status"` region announces
  changes ("18K Yellow Gold selected").
- **Contrast rule from the palette:** ink-600 `#56574f` on sand-200 `#e4e5de` is about 6.3:1
  and carries all hint text. ink-400 `#8a8b82` is about 2.6:1 and is therefore
  decorative/disabled only. This is a change — hint text at that lightness is load-bearing
  today.

## Out of scope

- The 5-step wizard, `wizard.css`, and the loading interstitial.
- `SiteHeader` / `SiteFooter` / breadcrumb.
- The 3D pipeline in `RingScene.tsx` beyond `CameraReset` and the still-capture signal.
- Pricing. The settings API exposes none, so no price appears anywhere.
- Adding a test framework.

## Verification

The repo has no test framework — no vitest, jest or playwright in `package.json` — and this
design does not add one, because a visual redesign is the wrong vehicle for introducing a test
harness. Verification is therefore:

- `npm run build` and `npm run lint` clean.
- Manual passes at 390×844 (iPhone 14), 360×640 (small Android), 768 and 1280.
- Keyboard-only pass: reach and operate every control, including the sheet.
- `prefers-reduced-motion` pass: no sheet animation, no rotate-hint animation.
- iOS-specific: engraving field does not trigger page zoom; sheet clears the keyboard; nothing
  sits under the home indicator.

An automated harness is worth doing, as its own piece of work.
