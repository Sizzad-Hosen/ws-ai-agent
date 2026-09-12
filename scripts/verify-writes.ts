import "dotenv/config";

import { toPlanValues } from "@/features/plans/schemas";
import { toAiConfigurationSettings } from "@/features/ai-settings/schemas";
import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";
import { TENANT_DISPLAY_STATUSES, tenantDisplayStatus } from "@/types/status";

async function main(): Promise<void> {
  // ---- plans: create, update, delete -------------------------------------
  const before = await repositories.plans.findAll();

  const created = await repositories.plans.create(
    "verify-temp-plan",
    toPlanValues({
      name: "Verify Temp Plan",
      description: "Created by verify-writes.",
      monthlyPrice: "19.00",
      annualPrice: "190.00",
      currency: "usd",
      highlights: "One\nTwo",
      accentColor: "#10B981",
      isActive: true,
    }),
  );

  if (created.monthlyPrice !== "19.00" || created.currency !== "USD") {
    throw new Error(
      `Plan create round-tripped badly: ${JSON.stringify(created)}`,
    );
  }
  if (created.features.highlights.length !== 2) {
    throw new Error("Plan highlights did not persist.");
  }

  const updated = await repositories.plans.update(
    created.id,
    toPlanValues({
      name: "Verify Temp Plan",
      description: "Updated by verify-writes.",
      monthlyPrice: "",
      annualPrice: "",
      currency: "eur",
      highlights: "Only one",
      accentColor: "#10B981",
      isActive: false,
    }),
  );

  if (updated.monthlyPrice !== null || updated.currency !== "EUR") {
    throw new Error(
      `Plan update round-tripped badly: ${JSON.stringify(updated)}`,
    );
  }
  if (updated.code !== created.code) {
    throw new Error("Plan code changed on update; it must be immutable.");
  }

  await repositories.plans.delete(created.id);

  const after = await repositories.plans.findAll();
  if (after.length !== before.length) {
    throw new Error("Plan delete did not restore the original catalogue.");
  }

  // ---- ai configuration ---------------------------------------------------
  const aiBefore = await repositories.aiConfiguration.findActive();
  const provider = aiBefore.providers[0];
  const model = aiBefore.models.find((m) => m.providerId === provider?.id);

  if (!provider || !model) {
    throw new Error("Seed data is missing an AI provider/model pair.");
  }

  await repositories.aiConfiguration.save(
    toAiConfigurationSettings({
      providerId: provider.id,
      modelId: model.id,
      isActive: true,
      globalTokenLimit: "123456",
      tenantAllocationEnabled: true,
      defaultTenantTokenLimit: "7890",
      warningThresholdPercent: "75",
    }),
  );

  const aiAfter = await repositories.aiConfiguration.findActive();
  if (aiAfter.configuration.globalTokenLimit !== 123456) {
    throw new Error("Global token limit did not persist.");
  }
  if (aiAfter.configuration.warningThresholdPercent !== 75) {
    throw new Error("Warning threshold did not persist.");
  }

  // Turning allocation off must clear the per-tenant default.
  await repositories.aiConfiguration.save(
    toAiConfigurationSettings({
      providerId: provider.id,
      modelId: model.id,
      isActive: true,
      globalTokenLimit: "123456",
      tenantAllocationEnabled: false,
      defaultTenantTokenLimit: "7890",
      warningThresholdPercent: "75",
    }),
  );

  const aiCleared = await repositories.aiConfiguration.findActive();
  if (aiCleared.configuration.defaultTenantTokenLimit !== null) {
    throw new Error("Disabling tenant allocation left a stale default limit.");
  }

  // Put the seeded configuration back so the check leaves no trace.
  await repositories.aiConfiguration.save({
    providerId: aiBefore.configuration.providerId,
    modelId: aiBefore.configuration.modelId,
    isActive: aiBefore.configuration.isActive,
    globalTokenLimit:
      aiBefore.configuration.globalTokenLimit === null
        ? null
        : BigInt(aiBefore.configuration.globalTokenLimit),
    defaultTenantTokenLimit:
      aiBefore.configuration.defaultTenantTokenLimit === null
        ? null
        : BigInt(aiBefore.configuration.defaultTenantTokenLimit),
    warningThresholdPercent: aiBefore.configuration.warningThresholdPercent,
  });

  const aiRestored = await repositories.aiConfiguration.findActive();
  if (
    aiRestored.configuration.globalTokenLimit !==
    aiBefore.configuration.globalTokenLimit
  ) {
    throw new Error("Failed to restore the seeded AI configuration.");
  }

  // ---- site settings ------------------------------------------------------
  const settingsBefore = await repositories.siteSettings.find();

  const writer = await prisma.adminUser.findFirstOrThrow({
    select: { id: true },
  });

  await repositories.siteSettings.save(
    {
      brand: { name: "Verify Brand", primary: "#123456" },
      contact: { supportEmail: "s@example.com", salesEmail: "x@example.com" },
      announcement: { enabled: true, message: "Hello" },
    },
    writer.id,
  );

  const settingsAfter = await repositories.siteSettings.find();
  if (settingsAfter.brand.name !== "Verify Brand") {
    throw new Error("Brand name did not persist.");
  }
  if (!settingsAfter.announcement.enabled) {
    throw new Error("Announcement flag did not persist.");
  }

  await repositories.siteSettings.save(settingsBefore, writer.id);

  // ---- tenant lifecycle ---------------------------------------------------
  // Its own tenant, not whichever one happens to exist: suspending a real
  // workspace to prove that suspending works takes the workspace down.
  const unique = `verify-writes-${Date.now().toString(36)}`;
  const fixture = await prisma.tenant.create({
    data: {
      tenantCode: `TEN-VERIFY-${unique.slice(-12)}`,
      businessName: "Verify Writes",
      ownerName: "Verify Owner",
      ownerEmail: `${unique}@example.test`,
      ownerPhone: "+1 555 000 0000",
      industry: "Testing",
      businessRegion: "US-East-1",
      slug: unique,
      approvalStatus: "APPROVED",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  try {
    // Suspension moves the lifecycle column, never the verdict.
    await repositories.tenants.updateStatuses(fixture.id, {
      status: "suspended",
    });
    const suspended = await repositories.tenants.findById(fixture.id);
    if (suspended?.status !== "suspended") {
      throw new Error("Tenant suspend did not persist.");
    }
    if (suspended.approvalStatus !== "approved") {
      throw new Error("Suspending a tenant changed its approval verdict.");
    }

    await repositories.tenants.updateStatuses(fixture.id, { status: "active" });
    const restored = await repositories.tenants.findById(fixture.id);
    if (restored?.status !== "active") {
      throw new Error("Tenant reactivate did not persist.");
    }

    // ---- the status filter agrees with the badge --------------------------
    // The console shows one status per tenant, derived from two columns, and
    // filters on the same four values. If the filter and the badge disagree,
    // a tenant is either missing from its own filter or listed under one it
    // does not show — so this walks the fixture through each display status
    // and checks the filter both finds it and excludes it from the others.
    for (const [change, expected] of [
      [{ status: "active" }, "approved"],
      [{ status: "suspended" }, "suspended"],
      [{ approvalStatus: "pending_review" }, "pending"],
      [{ approvalStatus: "rejected" }, "rejected"],
    ] as const) {
      await repositories.tenants.updateStatuses(fixture.id, change);

      const current = await repositories.tenants.findById(fixture.id);
      if (!current) throw new Error("The status fixture vanished.");

      const shown = tenantDisplayStatus(current);
      if (shown !== expected) {
        throw new Error(
          `Expected the tenant to show as "${expected}", got "${shown}".`,
        );
      }

      for (const filter of TENANT_DISPLAY_STATUSES) {
        const page = await repositories.tenants.findMany({
          status: filter,
          search: unique,
          limit: 100,
        });
        const found = page.items.some((item) => item.tenant.id === fixture.id);

        if (found !== (filter === expected)) {
          throw new Error(
            found
              ? `A tenant showing as "${shown}" was returned by the "${filter}" filter.`
              : `A tenant showing as "${shown}" was missing from the "${filter}" filter.`,
          );
        }
      }
    }
  } finally {
    await prisma.tenant.delete({ where: { id: fixture.id } });
  }

  console.log(
    "Plan create/update/delete, AI configuration, site settings and tenant lifecycle all verified against Postgres. Fixtures removed, settings restored.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
