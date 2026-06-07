"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { GlobeMarker, ToursGlobeImplProps } from "./tours-globe-impl";

export type { GlobeMarker };

// The globe is WebGL; if Three.js can't get a context (unsupported GPU,
// context lost, headless), the renderer throws on mount. Without this
// boundary that throw escapes to the page-level error.tsx and replaces
// the whole /tours page with the 500 screen — taking the accessible,
// offline card grid down with it. Catching here degrades to "just the
// grid", which is exactly the intended fallback.
class GlobeErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Tours globe failed to render; falling back to grid:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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
  return (
    <GlobeErrorBoundary>
      <ToursGlobeImpl {...props} />
    </GlobeErrorBoundary>
  );
}
