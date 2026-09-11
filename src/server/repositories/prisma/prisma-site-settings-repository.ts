import { Prisma } from "@prisma/client";

import {
  DEFAULT_SITE_SETTINGS,
  announcementSettingSchema,
  brandSettingSchema,
  contactSettingSchema,
  type SiteSettings,
} from "@/features/system/site-settings";
import { prisma } from "@/server/db/prisma";
import type { SiteSettingsRepository } from "@/server/repositories/contracts/site-settings-repository";

/**
 * `public_site_settings` left the MVP. Its three rows moved to
 * `platform_settings`, which has the same shape — a `key` primary key over an
 * untyped `value` jsonb — so the grouping and the versioned schemas in
 * `@/features/system/site-settings` carry over unchanged.
 *
 * One key per group rather than one per field, so a group is read and written
 * atomically and `brand.name` cannot survive a failed write of `brand.primary`.
 */
const SETTING_KEYS = {
  brand: "site.brand",
  contact: "site.contact",
  announcement: "site.announcement",
} as const;

/** Written on create so `platform_settings.description` is never blank. */
const DESCRIPTIONS: Record<string, string> = {
  [SETTING_KEYS.brand]: "Platform name and accent colour for the public site.",
  [SETTING_KEYS.contact]: "Support and sales addresses shown to the public.",
  [SETTING_KEYS.announcement]:
    "Site-wide banner above the public header, and whether it shows.",
};

export class PrismaSiteSettingsRepository implements SiteSettingsRepository {
  async find(): Promise<SiteSettings> {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
      select: { key: true, value: true },
    });

    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    // Each key degrades independently: a malformed `contact` row must not cost
    // the operator their brand settings too.
    const brand = brandSettingSchema.safeParse(byKey.get(SETTING_KEYS.brand));
    const contact = contactSettingSchema.safeParse(
      byKey.get(SETTING_KEYS.contact),
    );
    const announcement = announcementSettingSchema.safeParse(
      byKey.get(SETTING_KEYS.announcement),
    );

    return {
      brand: brand.success ? brand.data : DEFAULT_SITE_SETTINGS.brand,
      contact: contact.success ? contact.data : DEFAULT_SITE_SETTINGS.contact,
      announcement: announcement.success
        ? announcement.data
        : DEFAULT_SITE_SETTINGS.announcement,
    };
  }

  async save(values: SiteSettings, updatedBy: string): Promise<void> {
    const entries = [
      { key: SETTING_KEYS.brand, value: values.brand },
      { key: SETTING_KEYS.contact, value: values.contact },
      { key: SETTING_KEYS.announcement, value: values.announcement },
    ];

    // One transaction so the public site never reads a half-applied change.
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.platformSetting.upsert({
          where: { key: entry.key },
          update: {
            value: entry.value as Prisma.InputJsonValue,
            updatedBy,
          },
          create: {
            key: entry.key,
            value: entry.value as Prisma.InputJsonValue,
            description: DESCRIPTIONS[entry.key],
            updatedBy,
          },
        }),
      ),
    );
  }
}
