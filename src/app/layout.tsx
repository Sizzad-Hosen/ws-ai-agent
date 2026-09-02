import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} | Back Office`,
    template: `%s | ${APP_CONFIG.name}`,
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
    <html lang="en" className="h-full antialiased">
      <body className="bg-background text-foreground min-h-full">
        {children}
      </body>
    </html>
  );
}
