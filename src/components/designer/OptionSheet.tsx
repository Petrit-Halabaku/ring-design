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
  const [isWide, setIsWide] = useState(false);

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

    const cs = getComputedStyle(root);
    const appH = parseFloat(cs.getPropertyValue("--app-h")) || window.innerHeight;
    // Peek is derived from the STABLE height so the stage (which subtracts it) never
    // resizes when the keyboard opens. Only the sheet's own extent may follow --app-h.
    const layoutH = parseFloat(cs.getPropertyValue("--layout-h")) || window.innerHeight;

    const railH = railRef.current?.offsetHeight ?? 76;
    const peekH = Math.min(420, Math.max(240, layoutH * 0.38));
    const fullH = Math.max(peekH, appH - 88);

    geo.current = { railH, peekH, fullH };
    root.style.setProperty("--peek-h", `${Math.round(peekH)}px`);
    root.style.setProperty("--rail-h", `${Math.round(railH)}px`);
    root.style.setProperty("--sheet-full-h", `${Math.round(fullH)}px`);
    if (!isWide) applyOffset(offsetFor(snap));
  }, [applyOffset, offsetFor, snap, isWide]);

  useLayoutEffect(measure, [measure]);

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
    if (!dragging && !isWide) applyOffset(offsetFor(snap));
  }, [snap, dragging, applyOffset, offsetFor, isWide]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (isWide) return;
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
          className={isWide ? "hidden" : "grid h-11 w-full place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"}
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
          snap === "full" || isWide ? "overflow-y-auto [touch-action:pan-y]" : "overflow-hidden"
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
