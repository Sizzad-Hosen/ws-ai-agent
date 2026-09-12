import "dotenv/config";

import { createHash, randomBytes } from "node:crypto";

import { tenantBasePath } from "@/features/tenant-dashboard/routes";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";

/**
 * Mints a tenant session cookie for local work.
 *
 * Signing in by hand costs a password change and a form every time the
 * database is rebuilt, which is often. This writes a session row directly and
 * prints the cookie, so a page can be opened — or curled — as a real signed-in
 * user.
 *
 * Refuses to run in production. The whole point is to bypass sign-in, which is
 * a development convenience and nothing else.
 *
 * Usage:
 *   npm run dev:session -- northwind
 *   npm run dev:session -- northwind --curl
 */

function usage(): never {
  console.error("Usage: npm run dev:session -- <tenant-slug> [--curl]");
  process.exit(1);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to mint a session in production.");
  }

  const slug = process.argv[2];

  if (!slug || slug.startsWith("--")) usage();

  const resolution = await resolveTenant(slug);

  if (!resolution.ok) {
    throw new Error(
      `Tenant "${slug}" did not resolve (${resolution.reason}).` +
        (resolution.reason === "tenant-inactive"
          ? " It is approved but not ACTIVE, so no page of it can be served."
          : ""),
    );
  }

  const tenant = resolution.tenant;

  const user = await tenant.db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new Error(
      `Tenant "${slug}" has no users. Provisioning should have created the owner.`,
    );
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

  await tenant.db.userSession.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt,
    },
  });

  // INVITED is redirected to the change-password screen by the guard, which
  // would defeat the purpose of a session that can open any page.
  await tenant.db.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE" },
  });

  const base = tenantBasePath(tenant.slug);
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/+$/, "");

  if (process.argv.includes("--curl")) {
    // Just the header, for piping into a request.
    console.log(`tenant_session=${token}`);
    return;
  }

  console.info(`Signed in as ${user.name} <${user.email}> on /${tenant.slug}.`);
  console.info("");
  console.info("Paste this into the browser console on the site, then reload:");
  console.info(`  document.cookie = "tenant_session=${token}; path=${base}"`);
  console.info("");
  console.info("Or curl a page directly:");
  console.info(
    `  curl -s -H "cookie: tenant_session=${token}" ${appUrl}${base}/whatsapp`,
  );
  console.info("");
  console.info(`The session expires ${expiresAt.toISOString()}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Tenant pools are cached in module scope; without this the process hangs.
    process.exit(process.exitCode ?? 0);
  });
