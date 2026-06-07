"use client";

import { useEffect, useRef, useState } from "react";
import { TourGlobe } from "./tour-globe";
import type { GlobeExplorerProps } from "./globe-explorer";

// Defers the heavy Three.js globe chunk until the section scrolls near the
// viewport, so embedding the globe on the high-traffic home page doesn't
// load WebGL on initial paint. Until then it reserves the layout height so
// nothing shifts. The dynamic import inside <TourGlobe> only fires once we
// render it (i.e. once visible).
export function LazyTourGlobe(props: GlobeExplorerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // No IntersectionObserver (ancient browser) → leave the globe unmounted;
    // the section heading, body, and "Open the globe" CTA still render and
    // link to /tours. (IO is supported in every browser we target.)
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <TourGlobe {...props} />
      ) : (
        <div
          aria-hidden="true"
          className="h-[60vh] min-h-80 w-full rounded-lg bg-slate-950"
        />
      )}
    </div>
  );
}
