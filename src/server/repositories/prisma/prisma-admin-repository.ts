import { AdminStatus } from "@prisma/client";

import type { PlatformAdmin } from "@/features/auth/types";
import type { AdminCredentials } from "@/server/auth/types";
import { prisma } from "@/server/db/prisma";
import type { AdminRepository } from "@/server/repositories/contracts/admin-repository";
import type { ListQuery, PaginatedResult } from "@/types/repository";

import { mapAdmin } from "./mappers";

export class PrismaAdminRepository implements AdminRepository {
  async findById(id: string): Promise<PlatformAdmin | null> {
    const admin = await prisma.adminUser.findUnique({ where: { id } });
    return admin ? mapAdmin(admin) : null;
  }

  async findByEmail(email: string): Promise<PlatformAdmin | null> {
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    return admin ? mapAdmin(admin) : null;
  }

  async findCredentialsByEmail(
    email: string,
  ): Promise<AdminCredentials | null> {
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      email: admin.email,
      passwordHash: admin.passwordHash,
      role: mapAdmin(admin).role,
      isActive: admin.status === AdminStatus.ACTIVE,
    };
  }

  async findMany(
    query: ListQuery = {},
  ): Promise<PaginatedResult<PlatformAdmin>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { email: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const items = await prisma.adminUser.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { name: "asc" },
    });
    const total = await prisma.adminUser.count({ where });

    return { items: items.map(mapAdmin), total, limit, offset };
  }

  async countActive(): Promise<number> {
    return prisma.adminUser.count({ where: { status: AdminStatus.ACTIVE } });
  }

  async markSignedIn(id: string, signedInAt: Date): Promise<void> {
    await prisma.adminUser.update({
      where: { id },
      data: { lastLoginAt: signedInAt },
    });
  }
}
