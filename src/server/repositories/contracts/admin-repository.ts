import type { PlatformAdmin } from "@/features/auth/types";
import type { AdminCredentials } from "@/server/auth/types";
import type { ListQuery, PaginatedResult } from "@/types/repository";

export interface AdminRepository {
  findById(id: string): Promise<PlatformAdmin | null>;
  findByEmail(email: string): Promise<PlatformAdmin | null>;
  findCredentialsByEmail(email: string): Promise<AdminCredentials | null>;
  /** By id, for verifying the current password of the signed-in administrator. */
  findCredentialsById(id: string): Promise<AdminCredentials | null>;
  findMany(query?: ListQuery): Promise<PaginatedResult<PlatformAdmin>>;
  countActive(): Promise<number>;
  markSignedIn(id: string, signedInAt: Date): Promise<void>;
  /**
   * Name and email only.
   *
   * Role and status are absent on purpose: an administrator editing their own
   * profile must not be able to grant themselves a role, so the repository
   * offers no way to express it.
   */
  updateProfile(
    id: string,
    values: ProfileUpdate,
  ): Promise<UpdateProfileResult>;
  /** Returns the URL that was replaced, so the old file can be cleaned up. */
  updateAvatarUrl(id: string, avatarUrl: string): Promise<string | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}

export interface ProfileUpdate {
  readonly name: string;
  /** Already lowercased by the schema. */
  readonly email: string;
}

export type UpdateProfileResult =
  | { readonly ok: true }
  /** Another administrator already uses that address. */
  | { readonly ok: false; readonly reason: "email-taken" };
