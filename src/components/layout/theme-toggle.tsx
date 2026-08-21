"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemeToggleDict = {
  /** Accessible name for the control group. */
  groupLabel: string;
  systemLabel: string;
  lightLabel: string;
  darkLabel: string;
};

type Choice = "system" | "light" | "dark";

/** Shared with the anti-flash script in layout.tsx — keep the two in step. */
export const THEME_STORAGE_KEY = "wl.theme";

const CHOICES: Choice[] = ["system", "light", "dark"];

function isChoice(value: unknown): value is Choice {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Light / dark / system switcher.
 *
 * Until now the app followed `prefers-color-scheme` with no way to override it,
 * which assumes a person's OS setting is always what they want on this
 * particular site. It often is not — reading a dark-photograph tour in a bright
 * room, or the reverse.
 *
 * DEFAULT IS SYSTEM, and light is the fallback beneath it: a browser that
 * reports no preference at all gets the light palette, because that is what
 * `:root` defines. "System" is a real third state here rather than a synonym
 * for one of the other two — choosing it REMOVES the override rather than
 * writing today's resolved value, so a viewer who later flips their OS to dark
 * follows along instead of being frozen at whatever it was when they clicked.
 *
 * The choice is per-browser, in localStorage. It is a display preference, not
 * account data — it should not need an account, and it should not follow you to
 * a machine whose screen and lighting are different.
 */
/**
 * localStorage as an external store, rather than reading it into state in an
 * effect. Reading it during render would be a hydration mismatch (the server
 * has no idea what it says), and syncing it in an effect means a cascading
 * re-render — which is what the lint rule that rejected the first version was
 * pointing at.
 *
 * `subscribe` also listens for the `storage` event, so changing the theme in
 * one tab updates every other open tab for free.
 */
const themeStore = {
  subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener("wl:theme-change", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("wl:theme-change", onChange);
    };
  },
  getSnapshot(): Choice {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      return isChoice(stored) ? stored : "system";
    } catch {
      // Storage can be refused outright — private mode, or a browser set to
      // block site data. The switch still works for this page view; it just is
      // not remembered, which beats throwing.
      return "system";
    }
  },
  // The server cannot know the choice, so it renders the default and the
  // client corrects on hydration without a mismatch.
  getServerSnapshot(): Choice {
    return "system";
  },
};

export function ThemeToggle({ dict }: { dict: ThemeToggleDict }) {
  const choice = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );

  const apply = useCallback((next: Choice) => {
    const root = document.documentElement;

    if (next === "system") {
      // Remove the stamp rather than writing the currently-resolved value, so
      // the page keeps tracking the OS from here on.
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", next);
    }

    try {
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Same as above: unavailable storage must not break the switch itself.
    }

    // `storage` only fires in OTHER tabs, so this tab needs its own nudge to
    // re-read the store and repaint the selected state.
    window.dispatchEvent(new Event("wl:theme-change"));
  }, []);

  const labels: Record<Choice, string> = {
    system: dict.systemLabel,
    light: dict.lightLabel,
    dark: dict.darkLabel,
  };

  return (
    <div
      role="radiogroup"
      aria-label={dict.groupLabel}
      className="inline-flex items-center gap-0.5 rounded-md border border-line-strong p-0.5"
    >
      {CHOICES.map((value) => {
        const selected = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => apply(value)}
            className={[
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded px-2.5 text-xs font-semibold",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
              selected
                ? "bg-brand text-on-brand"
                : "text-muted hover:text-foreground hover:bg-line",
            ].join(" ")}
          >
            {labels[value]}
          </button>
        );
      })}
    </div>
  );
}
