import type { PlatformAdminRole } from "@/constants/roles";
import type { AdminStatus } from "@/types/status";

/** `admin_users` in the master ERD. */
export interface PlatformAdmin {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: PlatformAdminRole;
  readonly status: AdminStatus;
  readonly avatarUrl: string | null;
  readonly lastSignedInAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
