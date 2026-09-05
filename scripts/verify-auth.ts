import "dotenv/config";

import { hashSessionToken } from "@/server/auth/session";
import { repositories } from "@/server/repositories";
import { services } from "@/server/services";

async function main(): Promise<void> {
  const email = process.env.BO_SEED_ADMIN_EMAIL;
  const password = process.env.BO_SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "BO seed credentials are required for the authentication check.",
    );
  }

  const rejectedResult = await services.auth.login({
    email,
    password: `${password}-incorrect`,
    rememberMe: false,
  });

  if (rejectedResult) {
    throw new Error("Invalid BO credentials were unexpectedly accepted.");
  }

  const result = await services.auth.login({
    email,
    password,
    rememberMe: false,
  });

  if (!result) {
    throw new Error("The seeded administrator could not authenticate.");
  }

  await repositories.sessions.deleteByTokenHash(hashSessionToken(result.token));

  const dashboard = await services.dashboard.getSummary("30d");
  if (dashboard.kpis.length === 0) {
    throw new Error(
      "Seeded master data was not available to the dashboard service.",
    );
  }

  console.info(
    "BO authentication, session persistence, and master data verified.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
