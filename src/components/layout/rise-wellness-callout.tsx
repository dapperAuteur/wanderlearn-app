/**
 * Rise Wellness ecosystem callout — partner-vetted, byte-identical
 * across every WitUS sibling app. Per the canonical recipe at
 * https://raw.githubusercontent.com/dapperAuteur/witus-online/main/public/brand/footer-recipe.md
 *
 * The container surface (border + bg + accent) is the ONLY swap point
 * per app. Wanderlust uses emerald for the accent (travel/place
 * theme; matches existing positive-status patterns elsewhere in the
 * app).
 *
 * The `[YOUR APP NAME]` token from the recipe appears twice — both
 * resolved to "Wanderlust" here. Everything else inside the section
 * is verbatim. Don't paraphrase the services list. Don't trim the
 * disclaimer. Don't reorder.
 *
 * This component is English-only by deliberate policy — the
 * disclaimer was vetted with the partner in English; localizing it
 * would invalidate the agreement. Surrounding nav labels in the
 * parent footer are localized normally.
 */
export function RiseWellnessCallout() {
  return (
    <section
      aria-labelledby="rise-wellness-heading"
      className="mb-8 rounded-lg border border-emerald-100 bg-emerald-50/60 p-5 text-sm dark:border-emerald-400/30 dark:bg-emerald-500/10"
    >
      <header className="mb-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300">
          Mental health support
        </p>
        <h2 id="rise-wellness-heading" className="text-base font-semibold text-foreground">
          Rise Wellness of Indiana
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Independent mental health provider · Not affiliated with Wanderlust
        </p>
      </header>

      <p className="leading-relaxed text-zinc-700 dark:text-zinc-200">
        Rise Wellness of Indiana provides compassionate, personalized,
        holistic mental health care: evidence-based medicine, trauma-informed
        care, and a whole-person approach to help you heal, grow, and thrive
        in mind, body, and spirit.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">
            Services
          </p>
          <ul className="space-y-0.5 text-xs text-zinc-700 dark:text-zinc-200">
            <li>ADHD testing &amp; management (in-person and from home)</li>
            <li>Anxiety &amp; depression</li>
            <li>Maternal mental health</li>
            <li>Medication management</li>
            <li>GeneSight® genetic testing</li>
            <li>Behavioral therapy &amp; coaching</li>
            <li>Routine lab testing</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-zinc-500 dark:text-zinc-400">
            Visit or call
          </p>
          <address className="not-italic text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
            320 North Meridian Street<br />
            Indianapolis, IN 46204<br />
            Mon–Sat by appointment · Sun closed
          </address>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
            <a
              href="tel:+13179650299"
              className="inline-flex min-h-7 items-center font-medium text-emerald-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 rounded dark:text-emerald-300"
            >
              317-965-0299
            </a>
            <span aria-hidden="true" className="text-muted">·</span>
            <a
              href="https://risewellnessofindiana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-7 items-center font-medium text-emerald-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 rounded dark:text-emerald-300"
            >
              risewellnessofindiana.com
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <span aria-hidden="true" className="text-muted">·</span>
            <a
              href="https://www.centenarianos.com/safety#rise-wellness"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-7 items-center font-medium text-emerald-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 rounded dark:text-emerald-300"
            >
              Full safety page
              <span className="sr-only"> on centenarianos.com (opens in new tab)</span>
            </a>
          </div>
        </div>
      </div>

      <blockquote className="mt-4 border-l-2 border-emerald-300 pl-3 text-xs italic text-zinc-600 dark:border-emerald-400/60 dark:text-zinc-300">
        &ldquo;At Rise Wellness, we believe everyone has the capacity to rise
        above challenges and live a fulfilling, healthy life. Our care is
        guided by the belief that healing is personal, holistic, and rooted
        in compassion.&rdquo;
        <span className="block not-italic mt-1 text-zinc-500 dark:text-zinc-400">
          Rise Wellness of Indiana
        </span>
      </blockquote>

      {/* NON-NEGOTIABLE DISCLAIMER — vetted with the partner.
          Only the [YOUR APP NAME] token may be replaced. Don't paraphrase. */}
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Rise Wellness of Indiana is an independent organization. They are
        not affiliated with, employed by, or endorsed by Wanderlust,
        CentenarianOS, B4C LLC, AwesomeWebStore.com, or Anthony McDonald.
        We are grateful for their collaboration on mental health safety
        resources for our community.
      </p>
    </section>
  );
}
