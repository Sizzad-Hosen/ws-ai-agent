/**
 * Drops the master database, recreates it, replays every migration, then seeds.
 *
 * `prisma migrate reset` cannot do this job. It truncates inside the existing
 * database, so anything created outside a migration survives, and the reset is
 * not a true rebuild from empty.
 *
 * Safe to run twice. Run it with `npm run db:reset`.
 */
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import "dotenv/config";

function parseUrl(): { base: string; name: string; admin: string } {
  const raw = process.env.DATABASE_URL;
  if (raw === undefined || raw === "") {
    throw new Error("DATABASE_URL is not set.");
  }
  const base = raw.replace(/\?.*$/, "");
  const cut = base.lastIndexOf("/");
  return {
    base,
    name: base.slice(cut + 1),
    admin: `${base.slice(0, cut)}/postgres`,
  };
}

function run(command: string, args: readonly string[]): void {
  execFileSync(command, [...args], { stdio: "inherit", shell: true });
}

async function main(): Promise<void> {
  const { name, admin } = parseUrl();
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(
      `Refusing to reset a database with an unusual name: ${name}`,
    );
  }

  const client = new Client({ connectionString: admin });
  await client.connect();
  // Idle connections from a dev server would block the drop.
  await client.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [name],
  );
  await client.query(`DROP DATABASE IF EXISTS ${name}`);
  await client.query(`CREATE DATABASE ${name}`);
  await client.end();
  console.log(`Dropped and recreated ${name}.`);

  run("npx", ["prisma", "migrate", "deploy"]);
  run("npx", ["prisma", "db", "seed"]);
  console.log(`\n${name} is rebuilt and seeded.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
