import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";

import { APP_CONFIG } from "@/config/app";
import { env } from "@/config/env";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Required for absolute og:url and og:image; without it Next emits relative
  // URLs, which most crawlers and link unfurlers ignore.
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${APP_CONFIG.name} | Sell on WhatsApp, automatically`,
    template: `%s | ${APP_CONFIG.shortName}`,
  },
  description: APP_CONFIG.description,
  applicationName: APP_CONFIG.name,
  openGraph: {
    type: "website",
    siteName: APP_CONFIG.name,
    title: APP_CONFIG.name,
    description: APP_CONFIG.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: APP_CONFIG.name,
    description: APP_CONFIG.description,
  },
};

export default function RootLayout({ children }: Readonly<LayoutProps<"/">>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
