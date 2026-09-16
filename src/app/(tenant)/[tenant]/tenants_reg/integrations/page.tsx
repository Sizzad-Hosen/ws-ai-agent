import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app";
import { env } from "@/config/env";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { readTenantLocale } from "@/features/tenant-dashboard/tenant-locale";
import { WhatsappChannelCard } from "@/features/tenant-integrations/components/whatsapp-channel-card";
import { loadTenantWhatsapp } from "@/features/tenant-whatsapp/whatsapp-service";
import { translate, resolveLocale } from "@/lib/i18n/translate";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

/**
 * Integrations — the chat channels a workspace can connect.
 *
 * WhatsApp only, and deliberately. Facebook and Instagram are on the roadmap
 * and are not built, and a greyed-out card for each would be three-quarters of
 * this page promising things that do not work. They are added here when they
 * can actually be connected.
 */

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false, follow: false },
};

export default async function TenantIntegrationsPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/integrations">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  // The app id is public — the popup needs it — but the secret is never read
  // here and never sent to the browser.
  const embeddedSignupReady =
    env.META_APP_ID !== "" && env.META_CONFIG_ID !== "";

  const view = await loadTenantWhatsapp(tenant.id, embeddedSignupReady);
  const locale = resolveLocale(await readTenantLocale(tenant.id));
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const connection = view.connection;

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title={t("integrations.title")}
      description={t("integrations.chatChannelsHint")}
    >
      <section className="space-y-4">
        <h2 className="text-headline-sm text-foreground">
          {t("integrations.chatChannels")}
        </h2>

        {/*
          A grid rather than a single column, so adding Facebook and Instagram
          later is one more card and no layout change.
        */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WhatsappChannelCard
            slug={slug}
            locale={locale}
            productName={APP_CONFIG.name}
            partnerBusinessId={env.META_PARTNER_BUSINESS_ID}
            embeddedSignupReady={embeddedSignupReady}
            channel={
              connection === null
                ? null
                : {
                    verifiedName: connection.verifiedName,
                    displayPhoneNumber: connection.displayPhoneNumber,
                    live: connection.state === "LIVE",
                  }
            }
          />
        </div>
      </section>
    </TenantShell>
  );
}
