/**
 * Feature flags and platform settings.
 *
 * `platform_settings` also holds the brand name. It moved here when
 * `public_site_settings` left the MVP, so there is still one place to change
 * the product name.
 */
import { prisma } from "./client";

const FEATURE_FLAGS = [
  {
    key: "tenant_self_serve_signup",
    description:
      "Lets an approved tenant owner finish signup without an administrator.",
    defaultValue: false,
    rolloutPercent: 0,
  },
  {
    key: "ai_streaming_replies",
    description: "Streams AI replies token by token instead of sending one message.",
    defaultValue: true,
    rolloutPercent: 100,
  },
  {
    key: "whatsapp_template_editor",
    description: "In-app editor for WhatsApp message templates.",
    defaultValue: false,
    rolloutPercent: 25,
  },
] as const;

const SETTINGS = [
  {
    key: "brand.name",
    value: "Ordivex",
    description:
      "Product name shown in the public header, the back office and page titles.",
  },
  {
    key: "brand.support_email",
    value: "support@ordivex.com",
    description: "Reply-to address on every outbound platform email.",
  },
  {
    key: "billing.currency",
    value: "BDT",
    description: "Default currency for new plans and subscriptions.",
  },
  {
    key: "billing.trial_days",
    value: 14,
    description: "Length of the trial granted when a tenant is approved.",
  },
  {
    key: "registration.auto_approve",
    value: false,
    description:
      "When true, a submitted registration skips review. Off outside development.",
  },
  {
    key: "provisioning.default_tier",
    value: "shared",
    description:
      "tenant_databases.tier given to a newly approved tenant. One of shared, dedicated, isolated.",
  },
] as const;

export async function seedPlatform(): Promise<void> {
  for (const flag of FEATURE_FLAGS) {
    const fields = {
      description: flag.description,
      defaultValue: flag.defaultValue,
      rolloutPercent: flag.rolloutPercent,
      isActive: true,
    };
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: fields,
      create: { key: flag.key, ...fields },
    });
  }

  for (const setting of SETTINGS) {
    const fields = { value: setting.value, description: setting.description };
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: fields,
      create: { key: setting.key, ...fields },
    });
  }
}
