import "dotenv/config";

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
  const list = await repositories.tenants.findMany({ limit: 50, offset: 0 });
  const active = list.items.find(
    (item) => item.tenant.approvalStatus === "active",
  );

  if (!active) throw new Error("Seed has no active tenant to route to.");

  const label = active.tenant.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const target = await repositories.tenants.findRoutingTargetBySubdomain(label);

  if (!target) {
    throw new Error(`No routing target for seeded subdomain "${label}".`);
  }
  if (target.tenantId !== active.tenant.id) {
    throw new Error("Subdomain resolved to the wrong tenant.");
  }
  if (target.secretReference === "") {
    throw new Error("Routing target carries no secret reference.");
  }

  const missing =
    await repositories.tenants.findRoutingTargetBySubdomain("no-such-tenant");
  check(missing, null, "unknown subdomain resolves to null");

  // A suspended tenant keeps its host but must not be servable from it.
  const suspended = list.items.find(
    (item) => item.tenant.approvalStatus === "suspended",
  );

  if (suspended) {
    const suspendedLabel = suspended.tenant.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const suspendedTarget =
      await repositories.tenants.findRoutingTargetBySubdomain(suspendedLabel);

    if (suspendedTarget && suspendedTarget.approvalStatus !== "suspended") {
      throw new Error("Suspended tenant did not report its status.");
    }
  }

  console.log(
    `Tenancy verified: 15 host-parsing cases, secret provider policy, routing target for "${label}" -> ${target.databaseName} (provisioned: ${target.provisioned}).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
