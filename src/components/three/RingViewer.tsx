"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { SceneProps } from "./RingScene";

/** WebGL can't render on the server, so the canvas is client-only. */
const RingScene = dynamic(() => import("./RingScene"), {
  ssr: false,
  loading: LoadingPreview,
});

function LoadingPreview() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-label="Loading 3D preview">
      <div className="jos-loading-spinner" />
    </div>
  );
}

function WebGLUnavailablePreview() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-neutral-100 px-6 text-center text-sm text-neutral-600"
      role="img"
      aria-label="3D ring preview is unavailable because WebGL is not supported by this browser"
    >
      3D preview is unavailable in this browser.
    </div>
  );
}

let webglAvailability: boolean | undefined;

function getWebGLAvailability() {
  if (webglAvailability !== undefined) return webglAvailability;

  try {
    const canvas = document.createElement("canvas");
    webglAvailability = Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    webglAvailability = false;
  }

  return webglAvailability;
}

function subscribeToWebGLAvailability() {
  return () => {};
}

function getServerWebGLAvailability() {
  return null;
}

export default function RingViewer(props: SceneProps) {
  // Canvas creates its renderer asynchronously, where a context-creation failure becomes
  // an unhandled rejection. Probe first so browsers with WebGL disabled never mount it.
  // The server snapshot keeps the first render hydration-safe.
  const webglAvailable = useSyncExternalStore(
    subscribeToWebGLAvailability,
    getWebGLAvailability,
    getServerWebGLAvailability,
  );

  if (webglAvailable === false) return <WebGLUnavailablePreview />;
  if (webglAvailable === null) return <LoadingPreview />;

  return <RingScene {...props} />;
}
