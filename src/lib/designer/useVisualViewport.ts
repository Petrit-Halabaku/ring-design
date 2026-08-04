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
