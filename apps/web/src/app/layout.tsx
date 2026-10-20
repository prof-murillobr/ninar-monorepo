import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://ninar-app.com";
const siteName = "Ninar";
const siteTitle = "Ninar | Cuidado atento para cada momento";
const siteDescription =
  "Grave um chorinho por alguns segundos e veja hipóteses de cuidado, como fome, sono ou desconforto, com percentuais de confiança.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Ninar",
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "choro de bebê",
    "cuidados com bebê",
    "classificação de choro",
    "áudio de bebê",
    "Ninar",
  ],
  authors: [{ name: "Ninar" }],
  creator: "Ninar",
  publisher: "Ninar",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ninar — cuidado atento para cada momento",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff8f5",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: siteName,
  url: siteUrl,
  description: siteDescription,
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  isAccessibleForFree: true,
  disclaimer:
    "As hipóteses são experimentais e não substituem orientação profissional de saúde.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
