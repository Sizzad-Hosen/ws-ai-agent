import { z } from "zod";

/**
 * `public_site_settings` is a key/value table whose `value` column is untyped
 * jsonb. The ERD gives it no structure, so these versioned schemas are the
 * contract instead — the same approach taken for `plans.features` (D-05).
 *
 * A row that does not match its schema degrades to the default below rather
 * than throwing, so one malformed row cannot take down the settings screen.
 */

export const SITE_SETTING_KEYS = ["brand", "contact", "announcement"] as const;

export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

export const brandSettingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the platform name.")
    .max(120, "Platform name must be 120 characters or fewer."),
  primary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Enter a six-digit hex colour, e.g. #10B981."),
});

export const contactSettingSchema = z.object({
  supportEmail: z.email("Enter a valid support email address."),
  salesEmail: z.email("Enter a valid sales email address."),
});

export const announcementSettingSchema = z.object({
  enabled: z.boolean(),
  message: z
    .string()
    .trim()
    .max(280, "Announcement must be 280 characters or fewer."),
});

export const siteSettingsFormSchema = z
  .object({
    brand: brandSettingSchema,
    contact: contactSettingSchema,
    announcement: announcementSettingSchema,
  })
  .refine(
    (value) => !value.announcement.enabled || value.announcement.message !== "",
    {
      // An enabled banner with no text renders an empty bar on the public site.
      message: "Enter the message to display, or turn the announcement off.",
      path: ["announcement", "message"],
    },
  );

export type BrandSetting = z.infer<typeof brandSettingSchema>;
export type ContactSetting = z.infer<typeof contactSettingSchema>;
export type AnnouncementSetting = z.infer<typeof announcementSettingSchema>;
export type SiteSettings = z.infer<typeof siteSettingsFormSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brand: { name: "", primary: "#10B981" },
  contact: { supportEmail: "", salesEmail: "" },
  announcement: { enabled: false, message: "" },
};
