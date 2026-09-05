import type { SiteSettings } from "@/features/system/site-settings";

export interface SiteSettingsRepository {
  /** Missing or malformed rows fall back to defaults rather than throwing. */
  find(): Promise<SiteSettings>;
  save(values: SiteSettings): Promise<void>;
}
