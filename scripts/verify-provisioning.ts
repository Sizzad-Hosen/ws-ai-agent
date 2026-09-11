import "dotenv/config";

import {
  buildWebsiteUrl,
  deriveDatabaseName,
  deriveSubdomain,
  withSuffix,
} from "@/features/registrations/provisioning";
import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";

function check(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

async function main(): Promise<void> {
  // ---- derivation --------------------------------------------------------
  check(deriveSubdomain("Acme Corp"), "acme-corp", "plain name");
  check(deriveSubdomain("Café Niño"), "cafe-nino", "diacritics folded");
  check(deriveSubdomain("  Wayne Ent.  "), "wayne-ent", "punctuation trimmed");
  check(deriveSubdomain("!!!"), null, "no usable characters");
  check(deriveSubdomain("日本語"), null, "non-Latin script");
  check(withSuffix("acme", 1), "acme", "first attempt unsuffixed");
  check(withSuffix("acme", 2), "acme-2", "collision suffix");
  check(
    withSuffix("a".repeat(63), 2).length <= 63,
    true,
    "suffix respects limit",
  );
  check(
    deriveDatabaseName("acme-corp"),
    "sp_tenant_acme_corp",
    "database name",
  );
  check(
    buildWebsiteUrl("acme", "example.com"),
    "https://acme.example.com",
    "site url",
  );
  check(buildWebsiteUrl("acme", ""), null, "no root domain leaves url unset");

  // ---- provisioning against Postgres --------------------------------------
  const root = process.env.TENANT_ROOT_DOMAIN ?? "";
  // Tenant sites are served from the platform's own root, so the recorded URL
  // is the path form. See buildWebsiteUrl.
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const stamp = Date.now();
  const businessName = `Verify Provision ${stamp}`;
  const email = `verify-prov-${stamp}@example.test`;

  const code = await repositories.registrations.create({
    businessName,
    ownerName: "Verify Owner",
    ownerEmail: email,
    ownerPhone: "+1 555 000 9999",
    industry: "Grocery & Retail",
    region: "North America",
    requestedPlanId: null,
  });

  const queued = await prisma.tenantRegistration.findFirstOrThrow({
    where: { registrationCode: code },
    select: { id: true },
  });

  // Approval is gated on the checklist, so pass it the way a reviewer would.
  await prisma.tenantRegistrationCheck.updateMany({
    where: { tenantRegistrationId: queued.id },
    data: { status: "PASSED", checkedAt: new Date() },
  });

  const plans = (await repositories.plans.findAll())
    .map((item) => item.plan)
    .filter((plan) => plan.isActive && plan.monthlyPrice !== null);

  // The approving administrator, for `tenants.approved_by` and the audit row.
  const actor = await prisma.adminUser.findFirstOrThrow({
    select: { id: true },
  });

  const expectedPlan = plans[0];
  if (!expectedPlan?.monthlyPrice) {
    throw new Error("No priced active plan to assign.");
  }

  const outcome = await repositories.provisioning.provisionApprovedTenant({
    registrationId: queued.id,
    planId: expectedPlan.id,
    priceSnapshot: expectedPlan.monthlyPrice,
    currency: expectedPlan.currency,
    rootDomain: root,
    appUrl: APP_URL,
    region: "North America",
    actorId: actor.id,
  });

  if (!outcome.ok) {
    throw new Error(`Provisioning failed: ${outcome.reason}`);
  }

  const { tenant } = outcome;

  // ---- everything the approval promised must exist ------------------------
  const created = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenant.tenantId },
    include: { database: true, subscriptions: { include: { plan: true } } },
  });

  check(/^[0-9a-f-]{36}$/.test(created.id), true, "tenant id is a uuid");
  check(created.tenantCode.startsWith("TEN-"), true, "tenant code assigned");
  check(created.slug, deriveSubdomain(businessName), "subdomain assigned");
  check(
    tenant.websiteUrl,
    buildWebsiteUrl(created.slug, root, APP_URL),
    "website url derived from the slug",
  );
  // The verdict is settled; the workspace is not usable until its database is.
  check(created.approvalStatus, "APPROVED", "approved");
  check(created.status, "PROVISIONING", "starts provisioning");

  // The owner exists, invited, and the circular pair is closed.
  const owner = await prisma.tenantUser.findFirstOrThrow({
    where: { tenantId: created.id },
    select: {
      id: true,
      role: true,
      status: true,
      isOwner: true,
      passwordHash: true,
      inviteTokenHash: true,
    },
  });
  check(owner.role, "OWNER", "owner role");
  check(owner.status, "INVITED", "owner is invited, not active");
  check(owner.isOwner, true, "owner flag set");
  check(owner.passwordHash, null, "no password until the invite is accepted");
  check(owner.inviteTokenHash !== null, true, "invite token hash stored");
  check(created.ownerTenantUserId, owner.id, "tenant points back at its owner");

  // The subscription froze the plan limits at signup. Read from the catalogue
  // row rather than the domain Plan, which does not carry the limit columns.
  const catalogue = await prisma.plan.findUniqueOrThrow({
    where: { id: expectedPlan.id },
    select: { code: true, maxAiMessages: true },
  });
  const created_subscription = await prisma.subscription.findFirstOrThrow({
    where: { tenantId: created.id },
    select: { limitsSnapshot: true },
  });
  const limits = created_subscription.limitsSnapshot as Record<string, unknown>;
  check(limits.planCode, catalogue.code, "limits snapshot names the plan");
  check(
    limits.maxAiMessages,
    catalogue.maxAiMessages,
    "limits snapshot copied max_ai_messages",
  );

  if (!created.database)
    throw new Error("No tenant_databases row was created.");
  check(created.database.status, "PENDING", "database awaits provisioning");
  check(
    created.database.databaseName,
    deriveDatabaseName(created.slug ?? ""),
    "database name",
  );
  if (created.database.secretReference === "") {
    throw new Error("Database row carries no secret reference.");
  }

  check(created.subscriptions.length, 1, "one subscription");
  const subscription = created.subscriptions[0];
  check(subscription?.plan.id, expectedPlan.id, "plan assigned");
  check(subscription?.status, "TRIALING", "subscription trialing");
  check(
    subscription?.priceSnapshot.toFixed(2),
    expectedPlan.monthlyPrice,
    "price frozen at signup",
  );

  const registrationAfter = await prisma.tenantRegistration.findUniqueOrThrow({
    where: { id: queued.id },
    select: { status: true },
  });
  check(registrationAfter.status, "APPROVED", "registration marked approved");

  // ---- approving twice must not provision twice ---------------------------
  const second = await repositories.provisioning.provisionApprovedTenant({
    registrationId: queued.id,
    planId: expectedPlan.id,
    priceSnapshot: expectedPlan.monthlyPrice,
    currency: expectedPlan.currency,
    rootDomain: root,
    appUrl: APP_URL,
    region: "North America",
    actorId: actor.id,
  });
  check(second.ok, false, "second approval refused");

  const tenantCount = await prisma.tenant.count({
    where: { ownerEmail: email },
  });
  check(tenantCount, 1, "exactly one tenant for this owner");

  // ---- routing resolves the new tenant ------------------------------------
  const routed = await repositories.tenants.findRoutingTargetBySubdomain(
    created.slug ?? "",
  );
  check(routed?.tenantId, created.id, "subdomain routes to the new tenant");
  check(routed?.provisioned, false, "not servable until the database is ready");

  // ---- clean up ------------------------------------------------------------
  // Nothing in this database cascades, so every child goes before its parent.
  await prisma.subscription.deleteMany({ where: { tenantId: created.id } });
  await prisma.tenantDatabase.deleteMany({ where: { tenantId: created.id } });
  await prisma.adminAuditLog.deleteMany({ where: { tenantId: created.id } });
  // The tenant points at its owner, so that link is cleared before the owner
  // can go.
  await prisma.tenant.update({
    where: { id: created.id },
    data: { ownerTenantUserId: null },
  });
  await prisma.tenantUser.deleteMany({ where: { tenantId: created.id } });
  await prisma.tenant.delete({ where: { id: created.id } });
  await prisma.adminAuditLog.deleteMany({
    where: { resourceId: queued.id },
  });
  await prisma.tenantRegistrationCheck.deleteMany({
    where: { tenantRegistrationId: queued.id },
  });
  await prisma.tenantRegistration.delete({ where: { id: queued.id } });

  console.log(
    `Provisioning verified: 11 derivation cases; ${created.tenantCode} created with slug "${created.slug}", site ${tenant.websiteUrl ?? "(none)"}, database ${created.database.databaseName} (PENDING), ${subscription?.plan.name} plan at ${subscription?.priceSnapshot.toFixed(2)}. Double approval refused. Cleaned up.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
