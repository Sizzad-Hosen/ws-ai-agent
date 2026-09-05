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

export class PrismaSiteSettingsRepository implements SiteSettingsRepository {
  async find(): Promise<SiteSettings> {
    const rows = await prisma.publicSiteSetting.findMany({
      where: { siteKey: { in: ["brand", "contact", "announcement"] } },
    });

    const byKey = new Map(rows.map((row) => [row.siteKey, row.value]));

    // Each key degrades independently: a malformed `contact` row must not cost
    // the operator their brand settings too.
    const brand = brandSettingSchema.safeParse(byKey.get("brand"));
    const contact = contactSettingSchema.safeParse(byKey.get("contact"));
    const announcement = announcementSettingSchema.safeParse(
      byKey.get("announcement"),
    );

    return {
      brand: brand.success ? brand.data : DEFAULT_SITE_SETTINGS.brand,
      contact: contact.success ? contact.data : DEFAULT_SITE_SETTINGS.contact,
      announcement: announcement.success
        ? announcement.data
        : DEFAULT_SITE_SETTINGS.announcement,
    };
  }

  async save(values: SiteSettings): Promise<void> {
    const entries = [
      { siteKey: "brand", value: values.brand },
      { siteKey: "contact", value: values.contact },
      { siteKey: "announcement", value: values.announcement },
    ];

    // One transaction so the public site never reads a half-applied change.
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.publicSiteSetting.upsert({
          where: { siteKey: entry.siteKey },
          update: { value: entry.value as Prisma.InputJsonValue },
          create: {
            siteKey: entry.siteKey,
            value: entry.value as Prisma.InputJsonValue,
          },
        }),
      ),
    );
  }
}
