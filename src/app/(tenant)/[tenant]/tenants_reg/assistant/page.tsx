import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AssistantSettingsForm } from "@/features/storefront-assistant/components/assistant-settings-form";
import {
  loadAssistantSettings,
  loadFaq,
} from "@/features/storefront-assistant/settings";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";

export const metadata: Metadata = {
  title: "Assistant",
  robots: { index: false, follow: false },
};

export default async function AssistantPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/assistant">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  const [settings, faq] = await Promise.all([
    loadAssistantSettings(tenant.db),
    loadFaq(tenant.db),
  ]);

  return (
    <TenantShell
      slug={tenant.slug}
      businessName={tenant.businessName}
      user={user}
    >
      <PageHeader
        title="Assistant"
        description="The AI that answers customers on your storefront and takes their orders."
        actions={
          <Button variant="secondary" asChild>
            <Link href={`/${tenant.slug}`} target="_blank" rel="noreferrer">
              View storefront
            </Link>
          </Button>
        }
      />

      <AssistantSettingsForm slug={tenant.slug} settings={settings} faq={faq} />
    </TenantShell>
  );
}
