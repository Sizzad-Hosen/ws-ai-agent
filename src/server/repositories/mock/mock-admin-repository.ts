import type { PlatformAdmin } from "@/features/auth/types";
import type { AdminCredentials } from "@/server/auth/types";
import { mockAdmins } from "@/server/data/mock/master-data";
import type { AdminRepository } from "@/server/repositories/contracts/admin-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { paginate } from "./pagination";

export class MockAdminRepository implements AdminRepository {
  async findById(id: string): Promise<PlatformAdmin | null> {
    return mockAdmins.find((admin) => admin.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<PlatformAdmin | null> {
    const normalizedEmail = email.toLocaleLowerCase();
    return (
      mockAdmins.find(
        (admin) => admin.email.toLocaleLowerCase() === normalizedEmail,
      ) ?? null
    );
  }

  async findCredentialsByEmail(
    _email: string,
  ): Promise<AdminCredentials | null> {
    void _email;
    return null;
  }

  async findMany(
    query: ListQuery = {},
  ): Promise<PaginatedResult<PlatformAdmin>> {
    const search = query.search?.toLocaleLowerCase();
    const matches = search
      ? mockAdmins.filter((admin) =>
          `${admin.name} ${admin.email}`.toLocaleLowerCase().includes(search),
        )
      : mockAdmins;

    return paginate(matches, query);
  }

  async countActive(): Promise<number> {
    return mockAdmins.filter((admin) => admin.status === "active").length;
  }

  async markSignedIn(_id: string, _signedInAt: Date): Promise<void> {
    void _id;
    void _signedInAt;
  }
}
