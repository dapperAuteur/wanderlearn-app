"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/locales";
import { SignOutButton } from "./sign-out-button";

export type MobileNavItem = {
  href: string;
  label: string;
};

export type MobileNavDict = {
  openMenuLabel: string;
  closeMenuLabel: string;
  brandLabel: string;
  signIn: string;
  signOut: string;
  otherLanguage: string;
  changeLanguage: string;
};

export function MobileNavMenu({
  lang,
  otherLang,
  items,
  signedIn,
  displayName,
  dict,
}: {
  lang: Locale;
  otherLang: Locale;
  items: MobileNavItem[];
  signedIn: boolean;
  displayName: string;
  dict: MobileNavDict;
}) {
  const [open, setOpen] = useState(false);

  const closeOnNavigate = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={dict.openMenuLabel}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-black/10 text-xl sm:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15"
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

          <nav aria-label={dict.brandLabel} className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeOnNavigate}
                className="inline-flex min-h-12 items-center rounded-md px-3 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-2 flex flex-col gap-2 border-t border-black/5 pt-4 dark:border-white/10">
            <Link
              href={`/${otherLang}`}
              hrefLang={otherLang}
              aria-label={`${dict.changeLanguage}: ${dict.otherLanguage}`}
              onClick={closeOnNavigate}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
            >
              {dict.otherLanguage}
            </Link>
            {signedIn ? (
              <>
                {displayName ? (
                  <p className="truncate px-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {displayName}
                  </p>
                ) : null}
                <SignOutButton label={dict.signOut} lang={lang} />
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
