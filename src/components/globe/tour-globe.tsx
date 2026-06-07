"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { GlobeExplorerProps } from "./globe-explorer";

export type { GlobeMarker, GlobeLabels } from "./globe-explorer";

// react-globe.gl renders a WebGL canvas and touches `window`, so the
// explorer (which imports it) can only run client-side. dynamic(ssr:false)
// inside a client component, mirroring the virtual-tour viewer. The
// ~150 kB Three.js chunk loads on mount.
const GlobeExplorer = dynamic(() => import("./globe-explorer"), {
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

// If Three.js can't acquire a WebGL context (unsupported GPU, lost context,
// headless), the renderer throws on mount. Without this boundary that throw
// escapes to the page-level error.tsx and replaces the whole page with the
// 500 screen — taking the accessible card grid down with it. Catching here
// degrades to "just the grid", the intended fallback.
class GlobeErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Tour globe failed to render; falling back to grid:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function TourGlobe(props: GlobeExplorerProps) {
  return (
    <GlobeErrorBoundary>
      <GlobeExplorer {...props} />
    </GlobeErrorBoundary>
  );
}
