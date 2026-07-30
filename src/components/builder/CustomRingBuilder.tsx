"use client";

import { useCallback, useState } from "react";
import LoadingScreen from "./LoadingScreen";
import RingDesigner from "./RingDesigner";
import RingWizard, { type WizardResult } from "./RingWizard";

type Phase = "wizard" | "loading" | "designer";

/** Walkthrough → "Building your dream ring..." → 3D designer, same sequence as the live page. */
export default function CustomRingBuilder() {
  const [phase, setPhase] = useState<Phase>("wizard");
  const [picked, setPicked] = useState<WizardResult>({});

  const toLoading = useCallback((result: WizardResult) => {
    setPicked(result);
    setPhase("loading");
  }, []);
  const toDesigner = useCallback(() => setPhase("designer"), []);

  return (
    <>
      {/* {phase === "wizard" && <RingWizard onComplete={toLoading} />}
      {phase === "loading" && <LoadingScreen onDone={toDesigner} />}
      {phase === "designer" && ( */}
        <RingDesigner shapeId={picked.shapeId} carat={picked.carat} />
      {/* )} */}
    </>
  );
}
