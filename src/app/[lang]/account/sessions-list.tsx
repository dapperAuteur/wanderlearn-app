"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { revokeSession } from "@/lib/actions/account";

export type SessionsListDict = {
  heading: string;
  intro: string;
  currentLabel: string;
  unknownDevice: string;
  unknownLocation: string;
  signOutCta: string;
  signingOutLabel: string;
  emptyState: string;
  genericError: string;
};

export type SessionEntry = {
  token: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

function shortUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  // Tiny heuristic — enough to tell "is this my phone?" without
  // shipping a UA-parsing dependency.
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return ua.split(/[/(]/, 1)[0]?.trim() || null;
}

export function SessionsList({
  lang,
  sessions,
  dict,
}: {
  lang: Locale;
  sessions: SessionEntry[];
  dict: SessionsListDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function revoke(token: string) {
    setError(null);
    const form = new FormData();
    form.set("token", token);
    form.set("lang", lang);
    startTransition(async () => {
      const result = await revokeSession(form);
      if (!result.ok) {
        setError(result.error || dict.genericError);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="sessions-heading"
      className="rounded-lg border border-black/10 p-6 dark:border-white/15"
    >
      <h2 id="sessions-heading" className="text-lg font-semibold">
        {dict.heading}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{dict.intro}</p>

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm italic text-zinc-500 dark:text-zinc-400">
          {dict.emptyState}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {sessions.map((s) => {
            const device = shortUserAgent(s.userAgent) ?? dict.unknownDevice;
            const ip = s.ipAddress ?? dict.unknownLocation;
            return (
              <li
                key={s.token}
                className={`flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
                  s.isCurrent
                    ? "border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-400/40"
                    : "border-black/10 dark:border-white/15"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">
                    {device}{" "}
                    {s.isCurrent ? (
                      <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                        {dict.currentLabel}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {ip} · {s.createdAt.slice(0, 10)} → {s.expiresAt.slice(0, 10)}
                  </p>
                </div>
                {s.isCurrent ? null : (
                  <button
                    type="button"
                    onClick={() => revoke(s.token)}
                    disabled={pending}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-600/40 bg-transparent px-4 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    {pending ? dict.signingOutLabel : dict.signOutCta}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
