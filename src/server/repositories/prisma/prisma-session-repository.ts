import { AdminStatus } from "@prisma/client";

import type { StoredBoSession } from "@/server/auth/types";
import { prisma } from "@/server/db/prisma";
import type {
  CreateSessionRecord,
  SessionRepository,
} from "@/server/repositories/contracts/session-repository";

import { mapAdmin } from "./mappers";

export class PrismaSessionRepository implements SessionRepository {
  async create(input: CreateSessionRecord): Promise<void> {
    await prisma.adminSession.create({
      data: {
        adminUserId: input.adminId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<StoredBoSession | null> {
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    });

    // A revoked session is dead even before it expires.
    if (
      !session ||
      session.revokedAt !== null ||
      session.adminUser.status !== AdminStatus.ACTIVE
    ) {
      return null;
    }

    const admin = mapAdmin(session.adminUser);

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await prisma.adminSession.deleteMany({ where: { tokenHash } });
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await prisma.adminSession.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  }

  async revokeOthersForAdmin(
    adminId: string,
    keepTokenHash: string,
  ): Promise<number> {
    // Revoked rather than deleted: `findByTokenHash` already treats a revoked
    // session as dead, and keeping the row leaves a record that the session
    // existed and when it ended.
    const result = await prisma.adminSession.updateMany({
      where: {
        adminUserId: adminId,
        tokenHash: { not: keepTokenHash },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }
}
