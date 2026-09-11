import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";
import { tenantLabelFromHost } from "@/server/tenancy/host";
import {
  EnvSecretProvider,
  UnavailableSecretProvider,
  createSecretProvider,
  type SecretProvider,
} from "@/server/tenancy/secrets";

const ROOT = "example.com";

function check(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

async function main(): Promise<void> {
  // ---- host parsing -----------------------------------------------------
  // Anything doubtful must resolve to "no tenant", never to "some tenant".
  check(
    tenantLabelFromHost("acme.example.com", ROOT),
    "acme",
    "plain subdomain",
  );
  check(tenantLabelFromHost("ACME.Example.COM", ROOT), "acme", "case folding");
  check(tenantLabelFromHost("acme.example.com:3000", ROOT), "acme", "port");
  check(tenantLabelFromHost("example.com", ROOT), null, "apex is the platform");
  check(tenantLabelFromHost("www.example.com", ROOT), null, "www reserved");
  check(tenantLabelFromHost("bo.example.com", ROOT), null, "bo reserved");
  check(tenantLabelFromHost("api.example.com", ROOT), null, "api reserved");
  check(tenantLabelFromHost("a.b.example.com", ROOT), null, "nested label");
  check(tenantLabelFromHost("acme.evil.com", ROOT), null, "foreign root");
  check(
    tenantLabelFromHost("acme.example.com.evil.com", ROOT),
    null,
    "suffix smuggling",
  );
  check(tenantLabelFromHost("-acme.example.com", ROOT), null, "leading hyphen");
  check(tenantLabelFromHost("ac_me.example.com", ROOT), null, "underscore");
  check(tenantLabelFromHost("", ROOT), null, "empty host");
  check(
    tenantLabelFromHost("acme.example.com", ""),
    null,
    "unset root disables",
  );
  check(
    tenantLabelFromHost(`${"a".repeat(64)}.example.com`, ROOT),
    null,
    "label over 63 chars",
  );

  // ---- secret provider ---------------------------------------------------
  // Exercised through the port, which is how callers hold it.
  const unavailable: SecretProvider = new UnavailableSecretProvider();
  check(
    await unavailable.resolve("ref"),
    null,
    "unavailable provider resolves",
  );

  const envProvider = new EnvSecretProvider('{"ref/one":"pw"}');
  check(await envProvider.resolve("ref/one"), "pw", "env provider hit");
  check(await envProvider.resolve("ref/missing"), null, "env provider miss");

  // Production must never read credentials out of configuration.
  check(
    createSecretProvider("production", '{"ref/one":"pw"}').name,
    "unavailable",
    "production refuses env secrets",
  );
  check(
    createSecretProvider("development", '{"ref/one":"pw"}').name,
    "env",
    "development uses env secrets",
  );
  check(
    createSecretProvider("development", undefined).name,
    "unavailable",
    "no secrets configured",
  );

  let rejected = false;
  try {
    new EnvSecretProvider("not json");
  } catch {
    rejected = true;
  }
  check(rejected, true, "malformed secret JSON is rejected");

  // ---- routing target lookup --------------------------------------------
  // Fixtures are created here and removed at the end. The database seeds no
  // tenants, and a routing check that only runs when someone happens to have
  // approved one is not a check.
  const [active, suspended] = await Promise.all([
    createFixture("verify-routing-active", "ACTIVE", "READY"),
    createFixture("verify-routing-suspended", "SUSPENDED", "READY"),
  ]);

  try {
    const target = await repositories.tenants.findRoutingTargetBySubdomain(
      active.subdomain,
    );

    if (!target) {
      throw new Error(`No routing target for subdomain "${active.subdomain}".`);
    }
    if (target.tenantId !== active.id) {
      throw new Error("Subdomain resolved to the wrong tenant.");
    }
    if (target.secretReference === "") {
      throw new Error("Routing target carries no secret reference.");
    }
    check(target.provisioned, true, "a READY database reports provisioned");

    const missing =
      await repositories.tenants.findRoutingTargetBySubdomain("no-such-tenant");
    check(missing, null, "unknown subdomain resolves to null");

    // A suspended tenant keeps its host but must not be servable from it.
    const suspendedTarget =
      await repositories.tenants.findRoutingTargetBySubdomain(
        suspended.subdomain,
      );

    if (!suspendedTarget) {
      throw new Error("A suspended tenant lost its routing target entirely.");
    }
    check(
      suspendedTarget.status,
      "suspended",
      "suspended tenant reports its lifecycle status",
    );

    console.log(
      `Tenancy verified: 15 host-parsing cases, secret provider policy, routing target for "${active.subdomain}" -> ${target.databaseName} (provisioned: ${target.provisioned}), suspended host still resolves but reports suspended. Fixtures removed.`,
    );
  } finally {
    // No ON DELETE CASCADE anywhere, so the database rows go before their
    // tenants do.
    const ids = [active.id, suspended.id];
    await prisma.tenantDatabase.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
  }
}

/** A tenant with a provisioned database, for the routing checks. */
async function createFixture(
  label: string,
  status: "ACTIVE" | "SUSPENDED",
  databaseStatus: "READY" | "PENDING",
): Promise<{ readonly id: string; readonly subdomain: string }> {
  const unique = `${label}-${Date.now().toString(36)}`;
  const databaseName = `sp_tenant_${unique.replace(/-/g, "_")}`;

  const tenant = await prisma.tenant.create({
    data: {
      tenantCode: `TEN-VERIFY-${unique.slice(-12)}`,
      businessName: `Verify ${label}`,
      ownerName: "Verify Owner",
      ownerEmail: `${unique}@example.test`,
      ownerPhone: "+1 555 000 0000",
      industry: "Testing",
      businessRegion: "US-East-1",
      slug: unique,
      // The verdict is settled for every fixture here; what varies is the
      // lifecycle state the routing rules are being tested against.
      approvalStatus: "APPROVED",
      status,
      database: {
        create: {
          databaseName,
          hostReference: `secret://${databaseName}/host`,
          port: 5432,
          usernameReference: `secret://${databaseName}/username`,
          secretReference: `secret://${databaseName}/password`,
          status: databaseStatus,
          schemaVersion: "0",
          region: "US-East-1",
        },
      },
    },
    select: { id: true, slug: true },
  });

  return { id: tenant.id, subdomain: tenant.slug };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
