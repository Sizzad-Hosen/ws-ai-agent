import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import {
  LAST_STEP,
  nextStep,
  previousStep,
  resolveStep,
  type WizardStep,
} from "@/features/tenant-whatsapp/wizard";
import { StepFiveTest } from "@/features/tenant-whatsapp/components/wizard/step-five-test";
import { StepFourWebhook } from "@/features/tenant-whatsapp/components/wizard/step-four-webhook";
import { StepOnePreview } from "@/features/tenant-whatsapp/components/wizard/step-one-preview";
import { StepThreeCredentials } from "@/features/tenant-whatsapp/components/wizard/step-three-credentials";
import {
  Callout,
  Instructions,
  ScreenshotSlot,
  WizardShell,
} from "@/features/tenant-whatsapp/components/wizard/wizard-shell";
import { readTenantLocale } from "@/features/tenant-dashboard/tenant-locale";
import { resolveLocale, translatorFor } from "@/lib/i18n/translate";
import { getTenantContext } from "@/server/tenancy/tenant-context";
import { prisma } from "@/server/db/prisma";

export const metadata: Metadata = {
  title: "Connect WhatsApp",
  robots: { index: false, follow: false },
};

/**
 * The manual connect wizard: five screens, one Meta app, one phone number.
 *
 * It sits beside the Embedded Signup flow rather than replacing it. Embedded
 * Signup is fewer clicks and needs no Meta app at all, so it stays the path
 * offered first; this is for an owner whose Facebook account is restricted
 * from advertising, or who already runs their own app.
 *
 * Progress lives in the URL for now. `whatsapp_accounts.setup_step` is what it
 * will live in — the column and its migration are written — but the migration
 * cannot be applied while five stale 20260906 migrations still sort ahead of
 * it, so `savedStep` below reads LAST_STEP and every screen is reachable. The
 * one line marked SAVED STEP is all that changes when it lands.
 */
export default async function TenantWhatsappConnectPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/tenants_reg/whatsapp/connect">) {
  const { tenant: slug } = await params;
  const query = await searchParams;

  const { tenant, user } = await getTenantContext(slug);

  const locale = resolveLocale(await readTenantLocale(tenant.id));
  const t = translatorFor(locale);

  // SAVED STEP. Becomes `account?.setupStep ?? FIRST_STEP` once the migration
  // is applied, which is what makes a closed tab resume where it left off.
  const savedStep = LAST_STEP;
  const step = resolveStep(query.step, savedStep);

  const account = await prisma.whatsappAccount.findFirst({
    where: { tenantId: tenant.id },
    select: { phoneNumberId: true, webhookVerifyToken: true },
    orderBy: { createdAt: "desc" },
  });

  const basePath = `${tenantHref(slug, "whatsapp")}/connect`;
  const callbackUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/webhooks/whatsapp`;
  const temporaryHost = /ngrok|trycloudflare|loca\.lt/i.test(callbackUrl);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title={t("wizard.title")}
      description={t("wizard.step2.intro")}
    >
      <WizardShell
        t={t}
        step={step}
        reached={savedStep as WizardStep}
        basePath={basePath}
        // wa.me needs a number in international form with no punctuation. Not
        // configured yet, so the link is hidden rather than rendered dead.
        supportHref={null}
      >
        {step === 1 ? <StepOnePreview slug={slug} locale={locale} /> : null}

        {step === 2 ? (
          <div className="space-y-5">
            <p className="text-muted-foreground max-w-prose text-sm leading-6">
              {t("wizard.step2.intro")}
            </p>

            <Instructions
              items={[
                <>
                  {t("wizard.step2.item1")}{" "}
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 underline underline-offset-4"
                  >
                    developers.facebook.com
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </>,
                t("wizard.step2.item2"),
                t("wizard.step2.item3"),
                t("wizard.step2.item4"),
                t("wizard.step2.item5"),
              ]}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <ScreenshotSlot
                name="02-create-app.png"
                caption={t("wizard.step2.item2")}
              />
              <ScreenshotSlot
                name="02-use-case.png"
                caption={t("wizard.step2.item3")}
              />
            </div>

            <Callout
              tone="warning"
              icon={<TriangleAlert className="size-5" />}
            >
              {t("wizard.step2.warning")}
            </Callout>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <p className="text-muted-foreground max-w-prose text-sm leading-6">
              {t("wizard.step3.intro")}
            </p>

            <Instructions
              items={[
                t("wizard.step3.item1"),
                t("wizard.step3.item2"),
                t("wizard.step3.item3"),
              ]}
            />

            <ScreenshotSlot
              name="03-api-setup.png"
              caption={t("wizard.step3.intro")}
            />

            <StepThreeCredentials slug={slug} locale={locale} />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <StepFourWebhook
              slug={slug}
              locale={locale}
              callbackUrl={callbackUrl}
              verifyToken={account?.webhookVerifyToken ?? ""}
              phoneNumberId={account?.phoneNumberId ?? null}
            />

            {temporaryHost ? (
              <Callout tone="info" icon={<TriangleAlert className="size-5" />}>
                {t("wizard.step4.temporaryUrl")}
              </Callout>
            ) : null}

            <Instructions
              items={[
                t("wizard.step4.item1"),
                t("wizard.step4.item2"),
                t("wizard.step4.item3"),
                t("wizard.step4.item4"),
                t("wizard.step4.item5"),
              ]}
            />

            <Callout tone="danger" icon={<TriangleAlert className="size-5" />}>
              {t("wizard.step4.mustSubscribe")}
            </Callout>

            <ScreenshotSlot
              name="04-webhook-fields.png"
              caption={t("wizard.step4.item5")}
            />
          </div>
        ) : null}

        {step === 5 ? (
          <StepFiveTest
            slug={slug}
            locale={locale}
            phoneNumberId={account?.phoneNumberId ?? null}
          />
        ) : null}

        <div className="border-border flex flex-wrap items-center gap-3 border-t pt-5">
          {step > 1 ? (
            <Button variant="secondary" asChild>
              <Link href={`${basePath}?step=${previousStep(step)}`}>
                {t("common.back")}
              </Link>
            </Button>
          ) : null}

          {step < LAST_STEP ? (
            <Button asChild>
              <Link href={`${basePath}?step=${nextStep(step)}`}>
                {step === 1 ? t("wizard.step1.connect") : t("common.next")}
              </Link>
            </Button>
          ) : null}

          <Link
            href={tenantHref(slug, "whatsapp")}
            className="text-muted-foreground hover:text-foreground ml-auto text-sm underline underline-offset-4"
          >
            {t("common.skipForNow")}
          </Link>
        </div>
      </WizardShell>
    </TenantShell>
  );
}
