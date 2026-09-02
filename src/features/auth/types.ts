import type { PlatformAdminRole } from "@/constants/roles";
import type { AdminStatus } from "@/types/status";

export interface PlatformAdmin {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: PlatformAdminRole;
  readonly status: AdminStatus;
  readonly lastSignedInAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
