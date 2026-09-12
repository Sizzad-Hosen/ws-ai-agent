import type { StoredBoSession } from "@/server/auth/types";

export interface CreateSessionRecord {
  readonly adminId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  create(input: CreateSessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<StoredBoSession | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteExpired(now: Date): Promise<number>;
  /**
   * Revokes every other session an administrator holds, keeping the one that
   * asked. Used after a password change: whoever knew the old password should
   * not keep a live session, and signing the current browser out as well would
   * punish the person doing the right thing.
   *
   * Returns how many were revoked, so the result can say so.
   */
  revokeOthersForAdmin(adminId: string, keepTokenHash: string): Promise<number>;
}
