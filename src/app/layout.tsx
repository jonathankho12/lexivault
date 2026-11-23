import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { LanguageProvider } from "@/context/LanguageContext";
import { LexiVaultProvider } from "@/context/LexiVaultContext";
import { PwaInstallProvider } from "@/context/PwaInstallContext";
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
const SITE_TITLE = "LexiVault — AI-Powered C1–C2 English Vocabulary & Idiom Vault";
const SITE_DESCRIPTION =
  "Master C1–C2 English vocabulary, idioms, and collocations with Gemini AI autofill, SM-2 spaced repetition flashcards, daily learning packs, US/UK pronunciation audio, and real-time Supabase cloud sync.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "LexiVault",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "LexiVault",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
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
    <html lang="id" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-black text-[#F5F5F7] antialiased selection:bg-[#0A84FF]/35 selection:text-white">
        <LanguageProvider>
          <PwaInstallProvider>
            <LexiVaultProvider>{children}</LexiVaultProvider>
          </PwaInstallProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
