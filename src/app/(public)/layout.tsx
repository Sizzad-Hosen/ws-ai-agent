import type { ReactNode } from "react";

import { APP_CONFIG } from "@/config/app";
import { AnnouncementBanner } from "@/features/public-site/components/announcement-banner";
import { SiteFooter } from "@/features/public-site/components/site-footer";
import { SiteHeader } from "@/features/public-site/components/site-header";
import { repositories } from "@/server/repositories";

interface PublicLayoutProps {
  readonly children: ReactNode;
}

/**
 * Shell for the marketing site.
 *
 * Brand name, support address and the announcement banner are read from
 * `public_site_settings`, so editing them in the back office changes the public
 * site without a deploy.
 */
export default async function PublicLayout({ children }: PublicLayoutProps) {
  const settings = await repositories.siteSettings.find();
  const brandName = settings.brand.name || APP_CONFIG.name;

  return (
    <div className="bg-ps-page text-ps-ink flex min-h-screen flex-col font-sans">
      <AnnouncementBanner announcement={settings.announcement} />
      <SiteHeader brandName={brandName} />
      <main className="flex-1">{children}</main>
      <SiteFooter
        brandName={brandName}
        supportEmail={settings.contact.supportEmail}
      />
    </div>
  );
}
