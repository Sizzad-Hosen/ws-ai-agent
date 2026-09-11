/**
 * Compares the live master database against docs/db/master-db.sql.
 *
 * The SQL file is the source of truth. Prisma is only a means to build the
 * database, so this script must never read prisma/schema.prisma.
 *
 * Method: apply master-db.sql to a scratch database, then compare the two
 * catalogs column by column. Parsing the SQL text would be quicker, but a
 * parser bug would hide a real difference, which defeats the purpose.
 *
 * Exit code 0 means the two are identical. Exit code 1 lists every difference.
 *
 * Run it with `npm run db:diff`.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import "dotenv/config";

const SQL_PATH = "docs/db/master-db.sql";
const SCRATCH_SUFFIX = "_expected";

/** Prisma's own bookkeeping. It is infrastructure, not part of the design. */
const IGNORED_TABLE = "'_prisma_migrations'";

type Row = Record<string, string | null>;

/** Splits a Postgres URL into an admin URL and the database name. */
function parseUrl(): { base: string; name: string; admin: string } {
  const raw = process.env.DATABASE_URL;
  if (raw === undefined || raw === "") {
    throw new Error("DATABASE_URL is not set.");
  }
  const base = raw.replace(/\?.*$/, "");
  const name = base.slice(base.lastIndexOf("/") + 1);
  return {
    base,
    name,
    admin: `${base.slice(0, base.lastIndexOf("/"))}/postgres`,
  };
}

const QUERIES: ReadonlyArray<{ label: string; key: string; sql: string }> = [
  {
    label: "column",
    key: "id",
    sql: `SELECT table_name || '.' || column_name AS id,
                 data_type, udt_name, is_nullable,
                 coalesce(character_maximum_length::text, '') AS len,
                 coalesce(numeric_precision::text, '') AS prec,
                 coalesce(numeric_scale::text, '') AS scale
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name <> ${IGNORED_TABLE}
          ORDER BY 1`,
  },
  {
    label: "index",
    key: "id",
    sql: `SELECT indexname AS id,
                 regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX [^ ]+ ', 'CREATE \\1INDEX ') AS def
          FROM pg_indexes
          WHERE schemaname = 'public' AND tablename <> ${IGNORED_TABLE}
          ORDER BY 1`,
  },
  {
    label: "check",
    key: "id",
    sql: `SELECT c.conname AS id, pg_get_constraintdef(c.oid) AS def
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = 'public' AND c.contype = 'c'
          ORDER BY 1`,
  },
  {
    label: "foreign key",
    key: "id",
    sql: `SELECT c.conrelid::regclass || '.' || c.conname AS id,
                 pg_get_constraintdef(c.oid) AS def
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = 'public' AND c.contype = 'f'
          ORDER BY 1`,
  },
  {
    label: "enum",
    key: "id",
    sql: `SELECT t.typname AS id, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS values
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE n.nspname = 'public'
          GROUP BY t.typname ORDER BY 1`,
  },
];

async function snapshot(
  client: Client,
): Promise<Map<string, Map<string, Row>>> {
  const out = new Map<string, Map<string, Row>>();
  for (const q of QUERIES) {
    const result = await client.query<Row>(q.sql);
    const byKey = new Map<string, Row>();
    for (const row of result.rows) {
      const { [q.key]: id, ...rest } = row;
      byKey.set(String(id), rest as Row);
    }
    out.set(q.label, byKey);
  }
  return out;
}

function describe(row: Row): string {
  return Object.entries(row)
    .map(([k, v]) => `${k}=${v ?? "null"}`)
    .join(" ");
}

async function main(): Promise<void> {
  const { base, name, admin } = parseUrl();
  const scratch = `${name}${SCRATCH_SUFFIX}`;

  const adminClient = new Client({ connectionString: admin });
  await adminClient.connect();
  await adminClient.query(`DROP DATABASE IF EXISTS ${scratch}`);
  await adminClient.query(`CREATE DATABASE ${scratch}`);
  await adminClient.end();

  const expected = new Client({
    connectionString: `${base.slice(0, base.lastIndexOf("/"))}/${scratch}`,
  });
  await expected.connect();
  await expected.query(readFileSync(SQL_PATH, "utf8"));
  const want = await snapshot(expected);
  await expected.end();

  const live = new Client({ connectionString: base });
  await live.connect();
  const got = await snapshot(live);
  await live.end();

  const cleanup = new Client({ connectionString: admin });
  await cleanup.connect();
  await cleanup.query(`DROP DATABASE IF EXISTS ${scratch}`);
  await cleanup.end();

  const problems: string[] = [];
  for (const { label } of QUERIES) {
    const a = want.get(label) ?? new Map<string, Row>();
    const b = got.get(label) ?? new Map<string, Row>();
    for (const [id, row] of a) {
      const other = b.get(id);
      if (other === undefined) {
        problems.push(`missing ${label}: ${id}`);
      } else if (describe(row) !== describe(other)) {
        problems.push(
          `wrong ${label}: ${id}\n    expected  ${describe(row)}\n    live      ${describe(other)}`,
        );
      }
    }
    for (const id of b.keys()) {
      if (!a.has(id)) problems.push(`extra ${label}: ${id}`);
    }
  }

  const counts = QUERIES.map(
    (q) => `${q.label}s ${want.get(q.label)?.size ?? 0}`,
  ).join(", ");
  console.log(`Compared ${SQL_PATH} against ${name}: ${counts}.`);

  if (problems.length === 0) {
    console.log("Zero differences.");
    return;
  }
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\n${problems.length} difference(s).`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
