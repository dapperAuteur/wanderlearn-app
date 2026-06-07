"use client";

import dynamic from "next/dynamic";
import type { GlobeMarker, ToursGlobeImplProps } from "./tours-globe-impl";

export type { GlobeMarker };

// react-globe.gl renders a WebGL canvas and touches `window`, so it can
// only run client-side. Same dynamic(ssr:false)-inside-a-client-component
// pattern as the virtual-tour viewer. The skeleton keeps layout stable
// while the ~150 kB Three.js chunk + Earth texture load.
const ToursGlobeImpl = dynamic(() => import("./tours-globe-impl"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="flex h-[60vh] min-h-80 w-full items-center justify-center rounded-lg bg-slate-950 text-sm text-white/60"
    >
      …
    </div>
  ),
});

export function ToursGlobe(props: ToursGlobeImplProps) {
  return <ToursGlobeImpl {...props} />;
}
