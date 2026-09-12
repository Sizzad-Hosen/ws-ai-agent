import { AdminStatus, Prisma } from "@prisma/client";

import type { PlatformAdmin } from "@/features/auth/types";
import type { AdminCredentials } from "@/server/auth/types";
import { prisma } from "@/server/db/prisma";
import type {
  AdminRepository,
  ProfileUpdate,
  UpdateProfileResult,
} from "@/server/repositories/contracts/admin-repository";
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

  async findCredentialsById(id: string): Promise<AdminCredentials | null> {
    const admin = await prisma.adminUser.findUnique({ where: { id } });

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

  async updateProfile(
    id: string,
    values: ProfileUpdate,
  ): Promise<UpdateProfileResult> {
    try {
      await prisma.adminUser.update({
        where: { id },
        data: { name: values.name, email: values.email },
      });
    } catch (error: unknown) {
      // The unique index is what actually decides, so the conflict is caught
      // here rather than guessed at with a read first, which would race.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { ok: false, reason: "email-taken" };
      }

      throw error;
    }

    return { ok: true };
  }

  async updateAvatarUrl(id: string, avatarUrl: string): Promise<string | null> {
    const previous = await prisma.adminUser.findUnique({
      where: { id },
      select: { avatarUrl: true },
    });

    await prisma.adminUser.update({ where: { id }, data: { avatarUrl } });

    return previous?.avatarUrl ?? null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.adminUser.update({ where: { id }, data: { passwordHash } });
  }
}
