import Link from "next/link";
import type { Locale } from "@/lib/locales";

type FooterDict = {
  copyright: string;
  productHeading: string;
  companyHeading: string;
  legalHeading: string;
  relatedHeading: string;
  accessibility: string;
  privacy: string;
  terms: string;
  courses: string;
  howItWorks: string;
  witusOnline: string;
  brandAnthonyMcDonald: string;
  centenarianOs: string;
  workWitus: string;
  externalIndicator: string;
};

const RELATED_LINKS = [
  { key: "witusOnline", href: "https://witus.online" },
  { key: "brandAnthonyMcDonald", href: "https://brandanthonymcdonald.com" },
  { key: "centenarianOs", href: "https://centenarianos.com" },
  { key: "workWitus", href: "https://work.witus.online" },
] as const;

export function AppFooter({ dict, lang }: { dict: FooterDict; lang: Locale }) {
  return (
    <footer className="border-t border-black/5 dark:border-white/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <section aria-labelledby="footer-product">
            <h2 id="footer-product" className="text-sm font-semibold tracking-wide uppercase">
              {dict.productHeading}
            </h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <li>
                <Link
                  href={`/${lang}/courses`}
                  className="text-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
                >
                  {dict.courses}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/how-it-works`}
                  className="text-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
                >
                  {dict.howItWorks}
                </Link>
              </li>
            </ul>
          </section>

          <section aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="text-sm font-semibold tracking-wide uppercase">
              {dict.legalHeading}
            </h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <li>
                <Link
                  href={`/${lang}/accessibility`}
                  className="text-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
                >
                  {dict.accessibility}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/privacy`}
                  className="text-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
                >
                  {dict.privacy}
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/terms`}
                  className="text-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
                >
                  {dict.terms}
                </Link>
              </li>
            </ul>
          </section>

          <section aria-labelledby="footer-related" className="sm:col-span-2">
            <h2 id="footer-related" className="text-sm font-semibold tracking-wide uppercase">
              {dict.relatedHeading}
            </h2>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {RELATED_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-zinc-600 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
                  >
                    <span>{dict[link.key]}</span>
                    <span aria-hidden="true" className="text-xs">
                      ↗
                    </span>
                    <span className="sr-only">{dict.externalIndicator}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="mt-12 border-t border-black/5 pt-6 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
          {dict.copyright}
        </p>
      </div>
    </footer>
  );
}
