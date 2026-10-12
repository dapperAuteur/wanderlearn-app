"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { localeSwitcherEnabled } from "@/lib/locales";
import { ThemeToggle, type ThemeToggleDict } from "./theme-toggle";
import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/locales";
import { SignOutButton } from "./sign-out-button";
import type { NavGroup } from "./nav-disclosure";

export type MobileNavDict = {
  accountLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  brandLabel: string;
  signIn: string;
  signOut: string;
  signOutGlobal: string;
  otherLanguage: string;
  themeToggle: ThemeToggleDict;
  changeLanguage: string;
};

export function MobileNavMenu({
  lang,
  otherLang,
  groups,
  accountHref,
  signedIn,
  displayName,
  endSessionUrl = null,
  dict,
}: {
  lang: Locale;
  otherLang: Locale;
  groups: NavGroup[];
  accountHref: string;
  signedIn: boolean;
  displayName: string;
  /** Server-resolved WitUS end-session URL, or null for a purely local sign-out. */
  endSessionUrl?: string | null;
  dict: MobileNavDict;
}) {
  const [open, setOpen] = useState(false);

  const closeOnNavigate = () => setOpen(false);
  const linkClass =
    "flex min-h-12 items-center rounded-md px-3 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/5";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={dict.openMenuLabel}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-black/10 text-xl lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15"
        >
          <span aria-hidden="true">☰</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-dvh w-[min(90vw,20rem)] flex-col gap-4 overflow-auto bg-background p-5 shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-base font-semibold">
              {dict.brandLabel}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={dict.closeMenuLabel}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-black/10 text-xl hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:bg-white/5"
              >
                <span aria-hidden="true">×</span>
              </button>
            </Dialog.Close>
          </div>

          {/* Same groups as the bar, laid out as labelled sections rather than
              nested dropdowns: the drawer has the height, and every link stays
              one tap away. */}
          <nav aria-label={dict.brandLabel} className="flex flex-col gap-3">
            {groups.map((group) =>
              group.items.length === 1 ? (
                <Link
                  key={group.id}
                  href={group.items[0].href}
                  onClick={closeOnNavigate}
                  className={linkClass}
                >
                  {group.soloLabel ?? group.items[0].label}
                </Link>
              ) : (
                <div key={group.id}>
                  <h3
                    id={`mobile-nav-${group.id}`}
                    className="px-3 text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    {group.label}
                  </h3>
                  <ul aria-labelledby={`mobile-nav-${group.id}`} className="mt-1 flex flex-col gap-1">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} onClick={closeOnNavigate} className={linkClass}>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </nav>

          <div className="mt-2 flex flex-col gap-2 border-t border-black/5 pt-4 dark:border-white/10">
            {/* The bar hides the theme control below lg, so the menu carries it. */}
            <div className="flex justify-center pb-1">
              <ThemeToggle dict={dict.themeToggle} />
            </div>
            {/* Hidden until Spanish is fully hand-translated — see locales.ts. */}
            {localeSwitcherEnabled ? (
              <Link
                href={`/${otherLang}`}
                hrefLang={otherLang}
                aria-label={`${dict.changeLanguage}: ${dict.otherLanguage}`}
                onClick={closeOnNavigate}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong px-4 text-sm font-medium hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.otherLanguage}
              </Link>
            ) : null}
            {signedIn ? (
              <>
                {/* The Account link moved out of the item list and onto the
                    name, matching the bar. */}
                <Link
                  href={accountHref}
                  onClick={closeOnNavigate}
                  aria-label={displayName ? `${dict.accountLabel}: ${displayName}` : undefined}
                  className="block min-h-11 truncate rounded-md px-3 py-3 text-sm leading-5 text-muted hover:bg-black/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/5"
                >
                  {displayName || dict.accountLabel}
                </Link>
                <SignOutButton
                  label={dict.signOut}
                  globalLabel={dict.signOutGlobal}
                  lang={lang}
                  endSessionUrl={endSessionUrl}
                />
              </>
            ) : (
              <Link
                href={`/${lang}/sign-in`}
                onClick={closeOnNavigate}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-4 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {dict.signIn}
              </Link>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
