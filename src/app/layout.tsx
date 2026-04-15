import type { Metadata, Viewport } from "next";
import { siteName, siteTagline, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s · ${siteName}`,
  },
  description:
    "A place-based learning platform where every lesson begins with standing inside a real location — captured through 360° photo, 360° video, and drone footage.",
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
  authors: [{ name: "Wanderlearn" }],
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
    title: `${siteName} — ${siteTagline}`,
    description:
      "Learn from rainforest canopies, museum galleries, and chocolate workshops in Mexico City. Immersive courses captured in 360° and taught through curriculum built on top of the footage.",
    url: siteUrl,
    locale: "en_US",
    alternateLocale: ["es_MX"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — ${siteTagline}`,
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
