import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, IBM_Plex_Mono, Work_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { siteName, siteTagline, siteUrl } from "@/lib/site";
import "./globals.css";

/*
 * Passport Stamp type. Self-hosted by next/font at build time — no runtime
 * request to Google, so the fonts survive the offline-first gate and cannot
 * leak a visitor's IP to a third party on first paint.
 *
 * `display: "swap"` on all three: a FOUT is preferable to invisible text, and
 * Alfa Slab One is a display face whose absence would blank every heading.
 */
const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

// Display face. One weight only — Alfa Slab One ships 400 and nothing else.
const alfaSlab = Alfa_Slab_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-alfa-slab",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName}: ${siteTagline}`,
    template: `%s · ${siteName}`,
  },
  description:
    "A place-based learning platform where every lesson begins with standing inside a real location, captured through 360° photo, 360° video, and drone footage.",
  applicationName: siteName,
  keywords: [
    "immersive learning",
    "360 video",
    "place-based education",
    "virtual tour",
    "MUCHO",
    "chocolate museum",
    "online courses",
    "museum education",
  ],
  authors: [{ name: "Wanderlust" }],
  creator: siteName,
  publisher: siteName,
  formatDetection: { email: false, address: false, telephone: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName,
    title: `${siteName}: ${siteTagline}`,
    description:
      "Learn from rainforest canopies, museum galleries, and chocolate workshops in Mexico City. Immersive courses captured in 360° and taught through curriculum built on top of the footage.",
    url: siteUrl,
    locale: "en_US",
    alternateLocale: ["es_MX"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName}: ${siteTagline}`,
    description:
      "Immersive, place-based courses captured in 360°. Every lesson starts by standing inside a real place.",
  },
  icons: {
    icon: [
      { url: "/flywitus-platypus-logo.ico", sizes: "any" },
      { url: "/flywitus-platypus-logo.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/flywitus-platypus-logo.ico",
    apple: "/flywitus-platypus-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Must track --background in globals.css. This paints the browser chrome on
  // mobile, so a stale value here shows as a mismatched bar above the page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8ef" },
    { media: "(prefers-color-scheme: dark)", color: "#14131f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${workSans.variable} ${alfaSlab.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Applies the stored theme BEFORE first paint.

          Without this, a viewer who chose Dark gets a flash of the light page
          on every navigation: the server cannot know their choice (it lives in
          localStorage, which is client-only), so the HTML arrives unstamped and
          React only stamps it after hydration. That flash is worst for exactly
          the people who chose dark deliberately.

          It has to be inline and synchronous — an external or deferred script
          runs after the first paint, which is the thing being avoided. Wrapped
          in try/catch because storage access itself can throw when site data is
          blocked, and a theme preference must never be able to break the page.

          Only ever writes "light" or "dark"; anything else (including the
          "system" default) leaves the attribute off so the media query decides.
          Keep the key in step with THEME_STORAGE_KEY in theme-toggle.tsx.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("wl.theme");' +
              'if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}',
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {children}
        {/* Vercel Web Analytics: cookieless pageview counts + Web Vitals, no consent
            surface. Complements PostHog (which owns the product-event taxonomy)
            rather than replacing it. Mounted in the ROOT layout, above [lang], so
            embed and non-localised routes are counted too. Sends nothing until Web
            Analytics is ENABLED on the Vercel project. */}
        <Analytics />
      </body>
    </html>
  );
}
