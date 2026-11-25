import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LanguageProvider } from "@/context/LanguageContext";
import { LexiVaultProvider } from "@/context/LexiVaultContext";
import { PwaInstallProvider } from "@/context/PwaInstallContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0F" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

const SITE_URL = "https://lexivault.my.id";
const SITE_TITLE =
  "LexiVault — Master English & IELTS Fluency from A1 to C2";
const SITE_DESCRIPTION =
  "Elevate your English from A1 to C2 with targeted vocabulary drills, real-time grammar feedback, and 4-skill IELTS prep.";
const OG_IMAGE_ALT =
  "LexiVault — Master English & IELTS Fluency from A1 to C2 with adaptive A1–C2 vocabulary, 4-skill IELTS training, and real-time grammar feedback";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | LexiVault",
  },
  description: SITE_DESCRIPTION,
  applicationName: "LexiVault",
  keywords: [
    "LexiVault",
    "English fluency",
    "CEFR A1-C2",
    "IELTS preparation",
    "IELTS band score",
    "4-skill IELTS training",
    "English vocabulary drills",
    "grammar feedback",
    "SM-2 spaced repetition",
    "English idioms and collocations",
  ],
  authors: [{ name: "LexiVault", url: SITE_URL }],
  creator: "LexiVault",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "LexiVault",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json?v=2",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LexiVault",
  },
  icons: {
    icon: [
      { url: "/favicon.png?v=2", sizes: "64x64", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/icons/apple-touch-icon.png?v=2",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      data-theme="dark"
      className={`${inter.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[var(--ios-surface)] text-[var(--ios-text-primary)] antialiased selection:bg-[#0A84FF]/30 selection:text-[var(--ios-text-primary)]">
        <ThemeProvider>
          <LanguageProvider>
            <PwaInstallProvider>
              <LexiVaultProvider>{children}</LexiVaultProvider>
            </PwaInstallProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
