import type { PlatformAdminRole } from "@/constants/roles";

export interface AdminCredentials {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: PlatformAdminRole;
  readonly isActive: boolean;
}

export interface BoSessionAdmin {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: PlatformAdminRole;
}

export interface StoredBoSession {
  readonly id: string;
  readonly admin: BoSessionAdmin;
  readonly expiresAt: Date;
}
