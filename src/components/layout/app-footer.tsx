import Link from "next/link";
import type { Locale } from "@/lib/locales";
import { SIBLING_PRODUCTS } from "@/lib/sibling-products";
import {
  BugSatisfactionMetric,
  type BugSatisfactionMetricDict,
} from "./bug-satisfaction-metric";
import { RiseWellnessCallout } from "./rise-wellness-callout";

/**
 * Wanderlust footer, following the canonical WitUS ecosystem recipe at
 * https://raw.githubusercontent.com/dapperAuteur/witus-online/main/public/brand/footer-recipe.md
 *
 * Three semantic regions per the recipe:
 *   1. Product header (Wanderlust name + tagline)
 *   2. Rise Wellness callout — byte-identical across the ecosystem
 *      (see <RiseWellnessCallout/>; lives in its own file because
 *      the disclaimer is partner-vetted and must not drift)
 *   3. Three-column nav grid (Ecosystem · This app · Partners & Legal)
 *
 * Plus the existing copyright line and BugSatisfactionMetric, kept
 * below the recipe's content to preserve the partnership-pitch
 * metric introduced in feat/bug-resolution-loop.
 */

type FooterDict = {
  // App identity
  productTagline: string;
  // Column headings
  ecosystemHeading: string;
  thisAppHeading: string;
  partnersLegalHeading: string;
  // "This app" links
  courses: string;
  howItWorks: string;
  help: string;
  docs: string;
  signIn: string;
  // Partners & Legal
  riseWellness: string;
  riseWellnessSubtitle: string;
  terms: string;
  privacy: string;
  accessibility: string;
  contact: string;
  // Misc
  copyright: string;
  externalIndicator: string;
  externalIndicatorRiseWellness: string;
  bugSatisfactionMetric: BugSatisfactionMetricDict;
};

const externalLinkClasses =
  "inline-flex items-center gap-1 min-h-7 text-muted hover:text-brand-text hover:underline transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current rounded";

const internalLinkClasses =
  "inline-flex items-center min-h-7 text-muted hover:text-brand-text hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current rounded";

export function AppFooter({ dict, lang }: { dict: FooterDict; lang: Locale }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-dashed border-line">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        {/* Product header — text-only for v1; a WitUS logomark variant
            could be added later per the recipe's "optional logo" slot. */}
        <div className="mb-8 flex flex-col items-center text-center">
          <p className="font-display text-base text-foreground">Wanderlust</p>
          <p className="mt-1 text-xs text-muted">{dict.productTagline}</p>
        </div>

        <RiseWellnessCallout />

        <div className="grid grid-cols-1 gap-8 text-sm sm:grid-cols-3">
          <section aria-labelledby="footer-ecosystem">
            <h2 id="footer-ecosystem" className="font-display mb-2 text-foreground">
              {dict.ecosystemHeading}
            </h2>
            <ul className="space-y-1">
              {SIBLING_PRODUCTS.map((p) => (
                <li key={p.href}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={externalLinkClasses}
                  >
                    <span>{p.name}</span>
                    <span aria-hidden="true" className="text-[10px]">↗</span>
                    <span className="sr-only">{dict.externalIndicator}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="footer-this-app">
            <h2 id="footer-this-app" className="font-display mb-2 text-foreground">
              {dict.thisAppHeading}
            </h2>
            <ul className="space-y-1">
              <li>
                <Link href={`/${lang}/courses`} className={internalLinkClasses}>
                  {dict.courses}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/how-it-works`} className={internalLinkClasses}>
                  {dict.howItWorks}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/help`} className={internalLinkClasses}>
                  {dict.help}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/docs`} className={internalLinkClasses}>
                  {dict.docs}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/sign-in`} className={internalLinkClasses}>
                  {dict.signIn}
                </Link>
              </li>
            </ul>
          </section>

          <section aria-labelledby="footer-partners-legal">
            <h2 id="footer-partners-legal" className="font-display mb-2 text-foreground">
              {dict.partnersLegalHeading}
            </h2>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://www.centenarianos.com/safety#rise-wellness"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLinkClasses}
                >
                  <span>{dict.riseWellness}</span>
                  <span aria-hidden="true" className="text-[10px]">↗</span>
                  <span className="sr-only">{dict.externalIndicatorRiseWellness}</span>
                </a>
                <p className="text-xs leading-tight text-muted">
                  {dict.riseWellnessSubtitle}
                </p>
              </li>
              <li className="pt-2">
                <Link href={`/${lang}/terms`} className={internalLinkClasses}>
                  {dict.terms}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/privacy`} className={internalLinkClasses}>
                  {dict.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/accessibility`} className={internalLinkClasses}>
                  {dict.accessibility}
                </Link>
              </li>
              <li>
                <a href="mailto:bam@awews.com" className={internalLinkClasses}>
                  {dict.contact}
                </a>
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-center text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>
            © {year} {dict.copyright}{" "}
            <a
              href="https://awesomewebstore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-brand-text hover:underline"
            >
              AwesomeWebStore.com
              <span className="sr-only"> {dict.externalIndicator}</span>
            </a>{" "}
            brand
          </p>
          <BugSatisfactionMetric dict={dict.bugSatisfactionMetric} />
        </div>
      </div>
    </footer>
  );
}

export { BugSatisfactionMetric };
