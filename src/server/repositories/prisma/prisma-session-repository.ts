import { AdminStatus } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import type {
  CreateSessionRecord,
  SessionRepository,
} from "@/server/repositories/contracts/session-repository";
import type { StoredBoSession } from "@/server/auth/types";

import { mapAdmin } from "./mappers";

export class PrismaSessionRepository implements SessionRepository {
  async create(input: CreateSessionRecord): Promise<void> {
    await prisma.adminSession.create({ data: input });
  }

  async findByTokenHash(tokenHash: string): Promise<StoredBoSession | null> {
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { admin: true },
    });

    if (!session || session.admin.status !== AdminStatus.ACTIVE) {
      return null;
    }

    const admin = mapAdmin(session.admin);
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
}
