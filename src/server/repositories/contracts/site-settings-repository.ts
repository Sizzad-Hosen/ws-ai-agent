import type { SiteSettings } from "@/features/system/site-settings";

export interface SiteSettingsRepository {
  /** Missing or malformed rows fall back to defaults rather than throwing. */
  find(): Promise<SiteSettings>;
  /** `updatedBy` is the acting administrator, for `platform_settings.updated_by`. */
  save(values: SiteSettings, updatedBy: string): Promise<void>;
}
