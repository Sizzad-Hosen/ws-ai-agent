import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { APP_CONFIG } from "@/config/app";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} | Back Office`,
    template: `%s | ${APP_CONFIG.shortName}`,
  },
  description: APP_CONFIG.description,
  applicationName: APP_CONFIG.name,
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<LayoutProps<"/">>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
