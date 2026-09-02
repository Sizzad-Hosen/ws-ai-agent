import type { PlatformAdmin } from "@/features/auth/types";
import type { AdminCredentials } from "@/server/auth/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";

export interface AdminRepository {
  findById(id: string): Promise<PlatformAdmin | null>;
  findByEmail(email: string): Promise<PlatformAdmin | null>;
  findCredentialsByEmail(email: string): Promise<AdminCredentials | null>;
  findMany(query?: ListQuery): Promise<PaginatedResult<PlatformAdmin>>;
  countActive(): Promise<number>;
  markSignedIn(id: string, signedInAt: Date): Promise<void>;
}
