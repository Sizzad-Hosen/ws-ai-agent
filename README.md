# Ordivex — WhatsApp AI Sales Agent

Production-oriented foundation for Ordivex: the public marketing site and the
platform administration surface of a multi-tenant WhatsApp AI Sales Agent SaaS.
The product name lives in `src/config/app.ts`.

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

## Databases

Two ERDs, two schemas. `docs/db/SaaS Master DB — BO + Public Site.png` is the
platform's own database — administrators, tenants, plans, registrations,
public-site content — and is implemented in `prisma/schema.prisma`.
`docs/db/SaaS Tenant DB — Business + Storefront + AI + WhatsApp.png` is what
each tenant gets its own copy of, implemented in
`src/server/tenancy/schema/`. Operational tenant data belongs in the second and
must never be introduced into the first.

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

The seed writes **configuration only**: roles and permissions, the first
administrator, the plan catalogue, AI providers and models, and public-site
content. It creates no tenants, registrations, subscriptions or invoices —
those arrive through the application.

## The three surfaces

| Surface     | Address                        | Served by          |
| ----------- | ------------------------------ | ------------------ |
| Public site | `http://localhost:3000/`       | `src/app/(public)` |
| Back office | `http://localhost:3000/bo`     | `src/app/(bo)`     |
| Tenant site | `http://localhost:3000/<slug>` | `src/app/(tenant)` |

Tenant sites are served from the application root, so a tenant slug and a
top-level route share one namespace. `src/constants/reserved-slugs.ts` is what
keeps them apart: Next.js resolves a static route before a dynamic one, so a
tenant that claimed `pricing` would not shadow the marketing page — it would
simply never resolve, with nothing anywhere to explain why. Provisioning skips
a reserved slug and suffixes instead.

`TENANT_ROOT_DOMAIN` selects host addressing (`acme.example.com`) but nothing
in this application maps a host back to a tenant route, so the recorded site
URL is the path form whenever `NEXT_PUBLIC_APP_URL` is set.

## Tenant lifecycle

1. A visitor applies at `/register`. A `tenant_registrations` row is written
   `PENDING_REVIEW` with a three-item review checklist.
2. The application appears **on the tenants screen** at `/bo/tenants`, marked
   Pending Review, alongside the tenants it may become — and in the queue at
   `/bo/registrations`.
3. An administrator records a verdict on each checklist item. These are the
   reviewer's verdicts, attributed to their account; nothing contacts a company
   registry, a payment processor or Meta.
4. Approve provisions, in two stages that cannot share a transaction. The
   master records — tenant, database row, subscription — commit together. Then
   the **physical database is created** and the tenant schema applied, moving
   the row PENDING → PROVISIONING → READY, or FAILED.
5. The tenant's storefront is live at `/<slug>`.

The tenant schema lives in `src/server/tenancy/schema/`, transcribed from
`docs/db/SaaS Tenant DB — Business + Storefront + AI + WhatsApp.png` the same
way `prisma/schema.prisma` is transcribed from the master ERD: 25 tables
covering tenant staff and RBAC, the catalogue and inventory, carts, orders,
payments and reviews, WhatsApp accounts, contacts, conversations and messages,
and per-tenant AI configuration and usage.

It is applied by `src/server/tenancy/provision-database.ts`, the one module
that talks to Postgres as an administrator, on the credentials in
`TENANT_PROVISIONER_DATABASE_URL` (falling back to `DATABASE_URL`). Enum
members are conventional defaults awaiting confirmation, marked `[T-01]` in the
SQL — the same open question D-03 records for the master schema.

`npm run verify:lifecycle` exercises all of it against the real database and
removes everything it creates, the tenant database included.

## Architecture

- `src/app` contains App Router composition, route boundaries, and API handlers.
- `src/features` owns master-domain types and feature-specific presentation.
- `src/server/repositories/contracts` defines persistence-independent ports.
- `src/server/repositories/prisma` contains the active PostgreSQL adapters.
- `src/server/repositories/unavailable` serves the four ports that have no
  tables. They report _absence_, never zero, so a screen can say "there is no
  source for this" rather than "there is no activity".
- `src/server/services` contains application use cases and coordinates repositories.
- `src/server/tenancy` holds per-tenant concerns: host parsing, secret
  resolution, pooled per-tenant clients, and database provisioning.
- `src/components` contains design-system, shared-state, and application-shell UI.
- `src/config`, `src/constants`, `src/schemas`, and `src/types` contain cross-cutting,
  stable definitions.

The BO domain models only master-database responsibilities. Operational tenant
data belongs in each tenant database and must not be introduced into these
repositories.
