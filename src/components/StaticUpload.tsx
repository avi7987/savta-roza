"use client";

import UploadView from "./UploadView";
import { STATIC, useHashView } from "./Transition";

/** Preview build only: shows the upload screen over the home page when the address ends in #upload. */
export default function StaticUpload() {
  const view = useHashView();
  if (!STATIC || view !== "upload") return null;
  return (
    <div data-lenis-prevent className="fixed inset-0 z-[70] overflow-y-auto bg-cream">
      <UploadView />
    </div>
  );
}
