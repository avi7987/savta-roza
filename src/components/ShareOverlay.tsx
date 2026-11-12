"use client";

import { useEffect } from "react";
import ShareView from "./ShareView";
import { STATIC, getLenis, useHashView } from "./Transition";

/** Preview build only: shows the share page over the home page when the address ends in #share. */
export default function ShareOverlay() {
  const view = useHashView();
  const show = STATIC && view === "share";
  useEffect(() => {
    if (!show) return;
    getLenis()?.stop();
    return () => getLenis()?.start();
  }, [show]);
  if (!show) return null;
  return (
    <div data-lenis-prevent className="fixed inset-0 z-[70] overflow-y-auto bg-ivory">
      <ShareView />
    </div>
  );
}
