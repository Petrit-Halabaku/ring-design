"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Publishes two viewport heights on the shell element. The separation is the whole point.
 *
 * The engraving field lives in a bottom-anchored fixed sheet, so on iOS the keyboard covers
 * it. The conventional fix, `interactiveWidget: "resizes-content"`, shrinks the layout
 * viewport and would resize the WebGL canvas on every focus.
 *
 *   --app-h     visualViewport.height — shrinks with the keyboard. Sheet position only.
 *   --layout-h  window.innerHeight — ignores the keyboard. Stage height and --peek-h.
 *
 * Stage geometry must NEVER read --app-h. If it does, focusing the engraving field shrinks
 * the stage and resizes the canvas, which is the exact failure this hook exists to prevent:
 * on a 390x844 phone with the keyboard up, a stage sized from --app-h halves in height.
 */
export function useVisualViewport(ref: RefObject<HTMLElement | null>) {
  const [appH, setAppH] = useState(0);
  const [layoutH, setLayoutH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const vv = window.visualViewport;

    /** Visual height — follows the keyboard. */
    const measureVisual = () => {
      const h = vv?.height ?? window.innerHeight;
      el.style.setProperty("--app-h", `${Math.round(h)}px`);
      setAppH(h);
    };

    /** Layout height — deliberately not subscribed to visualViewport resize. */
    const measureLayout = () => {
      const h = window.innerHeight;
      el.style.setProperty("--layout-h", `${Math.round(h)}px`);
      setLayoutH(h);
      measureVisual();
    };

    measureLayout();

    vv?.addEventListener("resize", measureVisual);
    vv?.addEventListener("scroll", measureVisual);
    window.addEventListener("orientationchange", measureLayout);
    window.addEventListener("resize", measureLayout);

    return () => {
      vv?.removeEventListener("resize", measureVisual);
      vv?.removeEventListener("scroll", measureVisual);
      window.removeEventListener("orientationchange", measureLayout);
      window.removeEventListener("resize", measureLayout);
    };
  }, [ref]);

  return { appH, layoutH };
}
