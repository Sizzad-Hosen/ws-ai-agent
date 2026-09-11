/**
 * Feature flags and platform settings.
 *
 * `platform_settings` also holds the public site settings. They moved here
 * when `public_site_settings` left the MVP, grouped under `site.*` keys so
 * each group is read and written atomically — the shape
 * `PrismaSiteSettingsRepository` expects. Editing them in the back office is
 * what changes the public site, so there is one place to change the product
 * name.
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
    description:
      "Streams AI replies token by token instead of sending one message.",
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
    key: "site.brand",
    value: { name: "Ordivex", primary: "#10B981" },
    description: "Platform name and accent colour for the public site.",
  },
  {
    key: "site.contact",
    value: {
      supportEmail: "support@ordivex.com",
      salesEmail: "sales@ordivex.com",
    },
    description: "Support and sales addresses shown to the public.",
  },
  {
    key: "site.announcement",
    value: { enabled: false, message: "" },
    description:
      "Site-wide banner above the public header, and whether it shows.",
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

/**
 * Keys an earlier seed wrote that `SETTINGS` has replaced.
 *
 * Removed by name rather than by "delete anything unmanaged", so a key an
 * operator added by hand survives the seed.
 */
const SUPERSEDED_KEYS = ["brand.name", "brand.support_email"];

export interface PlatformSeedCounts {
  readonly flags: number;
  readonly settings: number;
}

export async function seedPlatform(): Promise<PlatformSeedCounts> {
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

  await prisma.platformSetting.deleteMany({
    where: { key: { in: SUPERSEDED_KEYS } },
  });

  return { flags: FEATURE_FLAGS.length, settings: SETTINGS.length };
}
