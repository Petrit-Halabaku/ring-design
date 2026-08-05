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

/** Travel before a press is treated as a drag rather than a tap on the control underneath. */
const PRESS_SLOP = 6; // px

type Props = {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Primary CTA. Pinned to the viewport bottom at every snap — see designer.css. */
  action?: ReactNode;
};

export default function OptionSheet({ categories, activeId, onSelect, action }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [dragging, setDragging] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Geometry, all px. Recomputed when the visual viewport or any measured strip resizes.
  const geo = useRef({ collapsedH: 177, peekH: 320, fullH: 480 });
  // `id` is the pointer being tracked (-1 = none); `active` marks that PRESS_SLOP was passed
  // and the gesture became a drag, which is what distinguishes a drag from a tap.
  const drag = useRef({
    startY: 0,
    startOffset: 0,
    lastY: 0,
    lastT: 0,
    v: 0,
    id: -1,
    active: false,
  });

  const offsetFor = useCallback((s: Snap) => {
    const { collapsedH, peekH, fullH } = geo.current;
    const visible = s === "collapsed" ? collapsedH : s === "peek" ? peekH : fullH;
    return Math.max(0, fullH - visible);
  }, []);

  const applyOffset = useCallback((y: number) => {
    sheetRef.current?.style.setProperty("--sheet-y", `${Math.round(y)}px`);
  }, []);

  /** Measures the shell and every fixed strip, publishes the px vars, and re-snaps. */
  const measure = useCallback(() => {
    const sheet = sheetRef.current;
    const root = sheet?.closest<HTMLElement>(".designer-root");
    if (!sheet || !root) return;

    const cs = getComputedStyle(root);
    const appH = parseFloat(cs.getPropertyValue("--app-h")) || window.innerHeight;
    // Peek is derived from the STABLE height so the stage (which subtracts it) never
    // resizes when the keyboard opens. Only the sheet's own extent may follow --app-h.
    const layoutH = parseFloat(cs.getPropertyValue("--layout-h")) || window.innerHeight;

    // Hidden at >=768px, so this is 0 there and the collapsed maths simply never runs.
    const handleH = handleRef.current?.offsetHeight ?? 44;
    const railH = railRef.current?.offsetHeight ?? 76;
    const actionH = actionRef.current?.offsetHeight ?? 0;

    // The collapsed strip has to clear all three fixed rows. Sizing it from the rail alone
    // left the handle sitting on top of the tabs and sliced their icons and labels in half —
    // the state meant to show "rail only, ring unobstructed" showed a grabber and a sliver.
    const collapsedH = handleH + railH + actionH;
    const peekH = Math.max(
      collapsedH,
      Math.min(420, Math.max(240, layoutH * 0.38)),
    );

    // Measure the top bar rather than assuming a height. It is 52px plus
    // env(safe-area-inset-top), so on a notched iPhone it is ~99px — a hardcoded 88 let the
    // sheet's top (and its drag handle) slide underneath the bar at the `full` snap.
    const barH = root.querySelector("header")?.getBoundingClientRect().height ?? 52;
    const fullH = Math.max(peekH, appH - barH - 8);

    geo.current = { collapsedH, peekH, fullH };
    root.style.setProperty("--peek-h", `${Math.round(peekH)}px`);
    root.style.setProperty("--rail-h", `${Math.round(railH)}px`);
    root.style.setProperty("--action-h", `${Math.round(actionH)}px`);
    root.style.setProperty("--sheet-full-h", `${Math.round(fullH)}px`);
    // Never stomp a live drag: re-snapping mid-gesture would yank the sheet back to the
    // snap the finger is currently leaving.
    if (!isWide && !drag.current.active) applyOffset(offsetFor(snap));
  }, [applyOffset, offsetFor, snap, isWide]);

  useLayoutEffect(measure, [measure]);

  /**
   * Whether anything is still below the fold of the body's *visible* window.
   *
   * The body extends past the viewport bottom by --sheet-y and is padded by that same amount
   * plus the action bar's height, so `scrollHeight - scrollTop - clientHeight` cancels out to
   * exactly the content hidden underneath the pinned CTA. Content that already fits reports
   * zero, so the cue never lies about there being more.
   */
  const syncOverflow = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    setHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    /*
     * Two observers, deliberately not one.
     *
     * Only the fixed strips feed the geometry, and the body must stay out of that loop: its
     * padding-bottom tracks --sheet-y, so a body-driven `measure()` turned every drag into a
     * feedback loop — dragging resized the body, which re-measured, which re-applied the
     * current snap's offset, and the sheet never moved.
     */
    const strips = new ResizeObserver(measure);
    for (const el of [railRef.current, actionRef.current]) {
      if (el) strips.observe(el);
    }

    // Controls appear and disappear between categories (prong karat, pave length), which
    // changes how much is below the fold without any snap or viewport change.
    const body = new ResizeObserver(syncOverflow);
    if (bodyRef.current) body.observe(bodyRef.current);

    return () => {
      vv?.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      strips.disconnect();
      body.disconnect();
    };
  }, [measure, syncOverflow]);

  // Switching category swaps the whole body, and changing snap changes how much of it shows.
  useLayoutEffect(syncOverflow, [syncOverflow, activeId, snap, isWide]);

  useEffect(() => {
    if (!dragging && !isWide) applyOffset(offsetFor(snap));
  }, [snap, dragging, applyOffset, offsetFor, isWide]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (isWide) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    /*
     * Deliberately NOT calling setPointerCapture here.
     *
     * This handler sits on a wrapper that CONTAINS the drag handle and the whole category
     * rail. Capturing on pointerdown retargets the subsequent pointerup to this wrapper, so
     * the browser generates its `click` on the wrapper instead of the button that was
     * pressed — which made every rail tab and the handle completely dead to taps, leaving
     * the sheet stuck on whichever category was selected first.
     *
     * Capture is taken lazily in onPointerMove, once travel exceeds PRESS_SLOP and the
     * gesture is unambiguously a drag rather than a tap.
     */
    drag.current = {
      startY: e.clientY,
      startOffset: offsetFor(snap),
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
      id: e.pointerId,
      active: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d.id !== e.pointerId) return;

    if (!d.active) {
      // Still ambiguous: a tap must stay a tap so the click lands on the tab underneath.
      if (Math.abs(e.clientY - d.startY) < PRESS_SLOP) return;
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }

    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;

    const { collapsedH, fullH } = geo.current;
    const next = Math.min(
      Math.max(0, d.startOffset + (e.clientY - d.startY)),
      fullH - collapsedH,
    );
    applyOffset(next);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d0 = drag.current;
    if (d0.id !== e.pointerId) return;
    d0.id = -1;
    // A press that never passed PRESS_SLOP was a tap: leave it alone so the click fires.
    if (!d0.active) return;
    d0.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);

    const d = drag.current;
    const { collapsedH, fullH } = geo.current;
    const landed = Math.min(
      Math.max(0, d.startOffset + (d.lastY - d.startY)),
      fullH - collapsedH,
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

  /*
   * Tapping is the primary way to work the sheet; dragging is an accelerator.
   *
   * The two controls have one meaning each rather than sharing a three-state cycle nobody
   * can predict: the tabs decide whether options are showing at all, and the handle decides
   * how much. That makes `collapsed` — the state that hands the whole viewport back to the
   * ring — reachable by tap, where before it existed only if you happened to try a drag.
   */
  function selectCategory(id: string) {
    onSelect(id);
    if (isWide) return;
    if (id !== activeId) {
      if (snap === "collapsed") setSnap("peek");
      return;
    }
    setSnap(snap === "collapsed" ? "peek" : "collapsed");
  }

  const expanded = isWide || snap !== "collapsed";
  const atFull = snap === "full";
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
          ref={handleRef}
          type="button"
          // The old label said "Expand options" while collapsed and then jumped straight past
          // `peek` to `full`. Both the wording and the arrow now name the actual destination.
          aria-label={atFull ? "Show fewer options" : "Show all options"}
          aria-expanded={atFull}
          aria-controls={`panel-${active.id}`}
          onKeyDown={onHandleKeyDown}
          onClick={() => setSnap(atFull ? "peek" : "full")}
          className={
            isWide
              ? "hidden"
              : "flex h-11 w-full flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
          }
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-sand-300" />
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className={`size-3 text-ink-400 transition-transform duration-200 ${atFull ? "" : "-rotate-180"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <CategoryRail
          categories={categories}
          activeId={activeId}
          onSelect={selectCategory}
          expanded={expanded}
          railRef={railRef}
        />
      </div>

      {/*
        Scrollable at every snap, not only at `full`. At `peek` this was `overflow-hidden`
        with no scrollbar and no drag handler bound to it, so a category like Band showed
        one and a half of its seven groups, cut mid-control, and a swipe on the body did
        literally nothing. Dragging is unaffected — its handlers live on the strip above.
      */}
      <div
        ref={bodyRef}
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
        onScroll={syncOverflow}
        className="designer-sheet-body min-h-0 flex-1 divide-y divide-line/50 overflow-y-auto px-4 [overscroll-behavior:contain] [touch-action:pan-y]"
      >
        {active.groups.map((g) => (
          <ControlGroup key={g.id} group={g} />
        ))}
      </div>

      {action && (
        <div
          ref={actionRef}
          // Positioning lives in designer.css — absolute and counter-translated on a phone,
          // relative at the end of the panel's flow on desktop. Don't add a `relative`
          // utility here; it would race that rule on source order alone.
          className="designer-sheet-action shrink-0 border-t border-line/60 bg-sand-50 px-4 pt-3"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          {/*
            The bar is opaque and floats over the body, so without this the content simply
            stopped at a hard edge and nothing suggested more was under it.
          */}
          {hasMore && expanded && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-full h-6 bg-gradient-to-t from-sand-50 to-transparent"
            />
          )}
          {action}
        </div>
      )}
    </div>
  );
}
