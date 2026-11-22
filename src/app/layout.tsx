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

export const metadata: Metadata = {
  title: "LexiVault — Personal English Trainer",
  description:
    "Personal English vocabulary, idiom, and collocation trainer with iOS Dark Liquid Glass UI, real-time sync, and zero-lag US/UK audio.",
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
