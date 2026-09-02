# WhatsApp AI Sales Agent — Back Office

Production-oriented foundation for the platform administration surface of a
multi-tenant WhatsApp AI Sales Agent SaaS.

## Commands

```bash
npm run dev
npm run dev:ready
npm run lint
npm run typecheck
npm run build
npm run format:check
```

Copy `.env.example` to `.env.local` when local overrides are needed. All
environment values are parsed at the server boundary with Zod.

## Master database

Set `DATABASE_URL` to a PostgreSQL master database, then run:

```bash
npm run db:migrate
npm run db:seed
```

For this repository's named local Prisma Postgres instance, `npm run
dev:ready` starts the database and then starts Next.js. Use `npm run dev` when
an external PostgreSQL database is already running.

The seed command reads the development administrator email and password from
`BO_SEED_ADMIN_EMAIL` and `BO_SEED_ADMIN_PASSWORD`, hashes the password, and
stores only the hash. Local `.env` files are ignored by Git.

## Architecture

- `src/app` contains App Router composition, route boundaries, and API handlers.
- `src/features` owns master-domain types and feature-specific presentation.
- `src/server/repositories/contracts` defines persistence-independent ports.
- `src/server/repositories/mock` and `src/server/data/mock` retain isolated mock
  adapters for tests and offline development.
- `src/server/repositories/prisma` contains the active PostgreSQL adapters.
- `src/server/services` contains application use cases and coordinates repositories.
- `src/components` contains design-system, shared-state, and application-shell UI.
- `src/config`, `src/constants`, `src/schemas`, and `src/types` contain cross-cutting,
  stable definitions.

The BO domain models only master-database responsibilities. Operational tenant
data belongs in each tenant database and must not be introduced into these
repositories.
