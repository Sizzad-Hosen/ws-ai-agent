import { Prisma } from "@prisma/client";

import type { PublicFaq } from "@/features/public-site/faq";
import { prisma } from "@/server/db/prisma";
import type { FaqRepository } from "@/server/repositories/contracts/faq-repository";

export class PrismaFaqRepository implements FaqRepository {
  async findPublished(): Promise<readonly PublicFaq[]> {
    return prisma.publicFaq.findMany({
      where: { isActive: true },
      // `sort_order` is not unique, so ties fall back to insertion order
      // rather than to whatever the planner happens to return.
      orderBy: [
        { sortOrder: Prisma.SortOrder.asc },
        { createdAt: Prisma.SortOrder.asc },
      ],
      select: { id: true, question: true, answer: true },
    });
  }
}
