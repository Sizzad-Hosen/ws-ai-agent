import { hash } from "bcryptjs";
import { AdminRole, AdminStatus } from "@prisma/client";

import { prisma } from "./client";
import { requiredSeedValue } from "./helpers";

/**
 * The first back-office administrator.
 *
 * Credentials come from the environment rather than being hard coded, so a
 * seeded environment never ships with a password that is public knowledge.
 */
export async function seedAdmin(): Promise<{ readonly id: string }> {
  const email = requiredSeedValue("BO_SEED_ADMIN_EMAIL").toLowerCase();
  const passwordHash = await hash(
    requiredSeedValue("BO_SEED_ADMIN_PASSWORD"),
    12,
  );

  const fields = {
    name: "Platform Administrator",
    passwordHash,
    role: AdminRole.SUPER_ADMIN,
    status: AdminStatus.ACTIVE,
  };

  return prisma.adminUser.upsert({
    where: { email },
    update: fields,
    create: { email, ...fields },
    select: { id: true },
  });
}
