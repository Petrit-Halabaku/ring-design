"use client";

import dynamic from "next/dynamic";
import type { SceneProps } from "./RingScene";

/** WebGL can't render on the server, so the canvas is client-only. */
const RingScene = dynamic(() => import("./RingScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="jos-loading-spinner" />
    </div>
  ),
});

export default function RingViewer(props: SceneProps) {
  return <RingScene {...props} />;
}
