import type { ActivityEntry } from "@/features/dashboard/types";

export interface ActivityRepository {
  recent(limit: number): Promise<readonly ActivityEntry[]>;
}
