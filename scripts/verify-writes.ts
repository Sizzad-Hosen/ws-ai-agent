import "dotenv/config";

import { toPlanValues } from "@/features/plans/schemas";
import { toAiConfigurationSettings } from "@/features/ai-settings/schemas";
import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";

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

  await repositories.siteSettings.save({
    brand: { name: "Verify Brand", primary: "#123456" },
    contact: { supportEmail: "s@example.com", salesEmail: "x@example.com" },
    announcement: { enabled: true, message: "Hello" },
  });

  const settingsAfter = await repositories.siteSettings.find();
  if (settingsAfter.brand.name !== "Verify Brand") {
    throw new Error("Brand name did not persist.");
  }
  if (!settingsAfter.announcement.enabled) {
    throw new Error("Announcement flag did not persist.");
  }

  await repositories.siteSettings.save(settingsBefore);

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
      region: "US-East-1",
      subdomain: unique,
      approvalStatus: "ACTIVE",
    },
    select: { id: true },
  });

  try {
    await repositories.tenants.updateApprovalStatus(fixture.id, "suspended");
    const suspended = await repositories.tenants.findById(fixture.id);
    if (suspended?.approvalStatus !== "suspended") {
      throw new Error("Tenant suspend did not persist.");
    }

    await repositories.tenants.updateApprovalStatus(fixture.id, "active");
    const restored = await repositories.tenants.findById(fixture.id);
    if (restored?.approvalStatus !== "active") {
      throw new Error("Tenant reactivate did not persist.");
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
