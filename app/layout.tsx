import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Anton } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppFloat from "@/components/layout/WhatsAppFloat";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AutoUpdater from "@/components/AutoUpdater";
import { Toaster, ToastProvider } from "@/components/ui/Toast";
import { siteUrl } from "@/lib/utils";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const condensed = Anton({ subsets: ["latin"], variable: "--font-condensed", display: "swap", weight: "400" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08080f" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — Free AI Tools, Image Utilities & Web Tools`,
    template: `%s | ${SITE_NAME}`,
  },
  description: `${SITE_TAGLINE} AI prompt studio, image converter & compressor, fancy text stylizer, bio generator, hashtag finder and more.`,
  keywords: ["ai tools", "prompt generator", "image converter", "image compressor", "fancy text generator", "hashtag generator", "free online tools"],
  authors: [{ name: SITE_NAME }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Free AI Tools & Web Utilities`,
    description: SITE_TAGLINE,
    url: siteUrl(),
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_TAGLINE },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

import ErrorBoundary from "@/components/ErrorBoundary";
import GlobalErrorHooks from "@/components/GlobalErrorHooks";
import JsonLd from "@/components/seo/JsonLd";
import { websiteJsonLd, organizationJsonLd } from "@/lib/seo";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${display.variable} ${condensed.variable} min-h-screen flex flex-col`}>
        <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <ToastProvider>
            <ServiceWorkerRegister />
            <AutoUpdater />
            <GlobalErrorHooks />
            <ErrorBoundary name="root">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </ErrorBoundary>
            <WhatsAppFloat />
            <Toaster />
          </ToastProvider>
          {(() => {
            // Publisher ID is public by design (also in ads.txt); env var takes precedence.
            const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "ca-pub-2122433170269090";
            return (
              <Script
                id="adsense-script"
                async
                strategy="afterInteractive"
                src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
                crossOrigin="anonymous"
              />
            );
          })()}
        </ThemeProvider>
        <InstallPrompt />
      </body>
    </html>
  );
}
