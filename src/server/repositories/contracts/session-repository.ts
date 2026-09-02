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
}
