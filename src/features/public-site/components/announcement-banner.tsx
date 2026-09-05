import { Megaphone } from "lucide-react";

import type { AnnouncementSetting } from "@/features/system/site-settings";

interface AnnouncementBannerProps {
  readonly announcement: AnnouncementSetting;
}

export function AnnouncementBanner({ announcement }: AnnouncementBannerProps) {
  // An enabled banner with no message would render an empty bar; the settings
  // form blocks that, and this guards the case anyway.
  if (!announcement.enabled || announcement.message === "") {
    return null;
  }

  return (
    <div className="bg-ps-ink text-white">
      <p className="container-ps flex items-center justify-center gap-2.5 py-2.5 text-center text-sm">
        <Megaphone className="size-4 shrink-0" aria-hidden="true" />
        {announcement.message}
      </p>
    </div>
  );
}
