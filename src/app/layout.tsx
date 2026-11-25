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
  themeColor: "#000000",
};

const SITE_URL = "https://lexivault.my.id";
const SITE_TITLE =
  "LexiVault — AI-Powered English Vocabulary, Idioms & IELTS (A1–C2)";
const SITE_DESCRIPTION =
  "Master English vocabulary, idioms, collocations, and IELTS from A1 to C2 with adaptive daily learning packs, AI-powered definitions, SM-2 spaced repetition flashcards, US/UK pronunciation audio, and real-time cloud sync.";

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
    "English vocabulary",
    "English idioms",
    "English collocations",
    "CEFR A1-C2",
    "SM-2 spaced repetition",
    "AI flashcards",
    "IELTS preparation",
    "pronunciation audio",
    "vocabulary builder",
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
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LexiVault — AI-Powered English Vocabulary, Idioms & IELTS (A1–C2)",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LexiVault",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
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
      <body className="min-h-screen bg-[var(--ios-obsidian)] text-[var(--ios-text-primary)] antialiased selection:bg-[#0A84FF]/30 selection:text-[var(--ios-text-primary)]">
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
