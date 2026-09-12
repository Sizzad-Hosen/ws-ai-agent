# Implementation Plan — BO (Back Office) Site

**Status:** Draft for review. No application code or schema has been changed.
**Scope of this document:** the Back-Office admin console (`docs/uiux/bo-site/`), backed by the master database (`docs/db/Ordivex Master DB Design.png`).
**Source of truth for the database:** `docs/db/Ordivex Master DB Design.png`. Nothing in this plan changes that schema. Section 2 raises the problems found in it and waits for decisions.

---

## 0. Documentation inventory — what actually exists

The brief refers to a PRD, System Design, Database Design, API Design and UI/UX Design. Only three of these are present in the repository:

| Artefact                     | Present                                  | Location                                        |
| ---------------------------- | ---------------------------------------- | ----------------------------------------------- |
| PRD                          | **No**                                   | —                                               |
| System / architecture design | **No**                                   | —                                               |
| Database design              | Yes (ERD image only, no data dictionary) | `docs/db/Ordivex Master DB Design.png` |
| API design                   | **No**                                   | —                                               |
| UI/UX — BO site              | Yes (12 screenshots + style guide)       | `docs/uiux/bo-site/`                            |
| UI/UX — public site          | Yes (6 screenshots + style guide)        | `docs/uiux/public-site/`                        |

Consequences, which shape everything below:

- **No behavioural requirements exist.** Every business rule in this plan is derived from what is _visible_ in a screenshot or _structurally implied_ by the ERD. Where a rule cannot be derived, it appears in section 8 (Questions / Decisions Required) instead of being invented.
- **No API design exists.** The endpoint tables in each module are _proposals_ derived from the screens, following the conventions already present in `src/` (Server Actions for mutations, Server Components for reads, repository ports under `src/server/repositories/contracts/`). They need sign-off.
- **No non-functional requirements exist** (SLA, retention, concurrency, tenant count, message volume). Sizing statements in section 6 are read off the mock data in the screenshots (1,240 tenants, 1,432 WhatsApp accounts, 450k messages/day, 1.2M AI messages/month) and should be confirmed.

The two style guides (`docs/uiux/bo-site/DESIGN-bo-admin.md`, `docs/uiux/public-site/DESIGN.md`) are complete and usable as-is.

---

## 1. Product understanding (derived strictly from the artefacts)

A multi-tenant SaaS that runs an AI sales agent over WhatsApp Business API. Each tenant is a business with its **own dedicated database** (`tenant_databases` in the ERD; `sp_tenant_urban_style` visible on screen 04). The Back Office is the platform operator's console over the master database.

Capabilities visible in the 12 BO screens:

| #       | Screen                    | Capability                                                                                                                                                                                                            |
| ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01      | Platform Overview         | Cross-tenant KPIs (tenants, MRR, GMV, AI/WA message counts, orders, AI resolution rate), MRR growth + message volume charts, platform activity feed                                                                   |
| 02      | Tenants list              | Search, filter by status/plan/WhatsApp, bulk-select, per-tenant plan / WhatsApp / AI status / messages / orders / MRR, paginated                                                                                      |
| 03      | Registration Review       | Pending registration with owner, applied plan, business details; review checklist (Business Verification, Payment Method Linked, WhatsApp API Approval) with "all checks must pass"; Approve / Reject                 |
| 04      | Tenant Details (approved) | UUID + database name, owner, applied plan, business details, Infrastructure Status (WhatsApp connection + webhook health, AI agent status + resolution rate, DB instance + last backup), **Login as Tenant**, Suspend |
| 05      | Plan Management           | Plan cards with price, limits (AI messages, WhatsApp numbers, team members, storage), feature toggles, ACTIVE / POPULAR badges, Create Plan, Edit Plan                                                                |
| 06      | Plan Create               | Name, description, monthly + annual price ("Save 20%"), accent colour, features, Active/Draft toggle                                                                                                                  |
| 07      | Plan Edit                 | Same fields, features one-per-line, Status & Visibility = Active (visible to new tenants) / Draft-Hidden (admins only)                                                                                                |
| 08 / 10 | AI Usage                  | Estimated cost, requests, avg cost per conversation, input tokens, error rate; token usage in/out over time; model distribution; cost trend; per-tenant usage vs plan limit                                           |
| 09      | AI Configuration          | Provider, secret API key (masked, with reveal), model name; global token limit, per-tenant allocation toggle, current usage, default tenant limit, warning threshold %                                                |
| 11      | WhatsApp Accounts         | Connected / disconnected / webhook errors / messages today; per-account tenant, number, Meta account ID, status, webhook health, quality rating, messages today, last event                                           |
| 12      | Message Monitoring        | Live feed of messages: id, tenant, direction, customer, status, latency, timestamp; All / Failed tabs; filters; Export Logs                                                                                           |

Cross-cutting UI present on most screens: global search, notifications, history, help, avatar menu, **Export Data**, **Create/New Tenant**.

---

## 2. Database findings

> **Status update.** §2.1 is **resolved and implemented**: the ERD is the schema
> of record, `prisma/schema.prisma` now transcribes all 18 of its tables, the
> superseded baseline has been dropped, and the seed and repositories are
> ported. Decisions taken while implementing are recorded in §2.10.
> **§2.2 – §2.5 remain open** and still gate modules M9 – M13.

### 2.1 Problem 1 (critical) — ✅ RESOLVED: the committed schema was not the documented schema

`prisma/schema.prisma` (migration `20260902173259_init_master_schema`, already applied) and the ERD in `docs/db` describe **two different databases**. This is not drift at the field level; roughly two-thirds of each side is absent from the other.

**In the ERD, missing from Prisma (12 tables):**
`admin_roles`, `permissions`, `admin_role_permissions`, `tenant_registrations`, `tenant_registration_checks`, `invoices`, `ai_providers`, `ai_models`, `platform_ai_configurations`, `public_pages`, `public_faqs`, `public_site_settings`

**In Prisma, absent from the ERD (10 models):**
`TenantUser`, `TenantMembership`, `PlatformConfiguration`, `PlatformAiSettings`, `WhatsappRoutingMetadata`, `UsageSummary`, `BillingMetadata`, `FeatureFlag`, `TenantFeatureFlag`, `PlatformAuditLog`

**Field-level divergence on tables that exist on both sides:**

| Entity             | ERD                                                                                                                 | Prisma today                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Primary keys       | `UUID`                                                                                                              | `cuid()` `String`                                                                            |
| Table naming       | `snake_case`                                                                                                        | PascalCase (`"PlatformAdmin"`)                                                               |
| admin_users        | `avatar_url`, `last_login_at`                                                                                       | no avatar, `lastSignedInAt`                                                                  |
| admin_sessions     | `revoked_at`, `ip_address` (INET), `user_agent`                                                                     | none of the three                                                                            |
| tenants            | `tenant_code`, `business_name`, `owner_name`, `owner_email`, `owner_phone`, `industry`, `region`, `approval_status` | `name`, `slug`, `status`                                                                     |
| plans              | `monthly_price` + `annual_price` **decimal nullable**, `features` **jsonb**, `sort_order`, `is_active` **boolean**  | `monthlyPriceMinor` **Int**, typed limit columns, `status` **3-value enum**, no annual price |
| subscriptions      | `billing_cycle`, `price_snapshot`, `currency`, `cancelled_at`                                                       | no billing cycle, no price snapshot, no currency, `cancelAtPeriodEnd` boolean                |
| tenant DB registry | `tenant_databases` with `database_name`, `host_reference`, `port`, `username_reference`, `schema_version`           | `TenantDatabaseRegistry` with `databaseKey`, `region`, no host/port/username/schema version  |
| Timestamps         | `timestamp`                                                                                                         | `Timestamptz(3)`                                                                             |

**Impact.** Only screens _Login_ and _Dashboard_ are buildable on the current schema. Screens 03, 05, 06, 07, 09 cannot be built at all — the tables they read do not exist. Screens 02 and 04 would have to render fields (`tenant_code`, `owner_email`, `industry`, `region`, `database_name`) that the current `Tenant` model does not carry. The seed and both existing Prisma repositories are written against the current shape, so any reconciliation also rewrites `prisma/seed.ts`, `src/server/repositories/prisma/*`, `src/features/*/types.ts` and `src/types/status.ts`.

**Minimum change proposed.** Treat the ERD as authoritative and replace the initial migration rather than patching it, because the divergence is structural and the database has no production data yet (single dev instance, seeded):

1. Rewrite `prisma/schema.prisma` to the 18 ERD tables exactly: snake_case via `@@map`/`@map`, `String @id @default(uuid()) @db.Uuid`, ERD column names, ERD nullability, ERD varchar lengths.
2. Keep **two** deviations from the ERD as-drawn, because they are correctness bugs rather than design choices — flagged as decisions D-07 and D-08 in section 8: `timestamptz` instead of `timestamp`, and explicit `decimal(12,2)` precision for all money columns.
3. Delete and regenerate `prisma/migrations/` as a single `init_master_schema_v2`. **Only valid while no environment holds real data — confirm before doing this.**
4. Port `prisma/seed.ts` and the five Prisma repositories to the new shape.
5. Carry over the 10 Prisma-only models **only** where a screen needs them, and only with explicit approval per table (see 2.3).

**Outcome.** Approved and executed. Two migrations now exist:
`20260905080000_init_master_schema` creates the 18 ERD tables, and
`20260905080100_drop_superseded_schema` removes the 16 tables and 8 enums left
by the previous baseline. `prisma migrate diff` reports no drift, and the seed
is idempotent across repeated runs.

### 2.2 Problem 2 (critical): five screens have no tables anywhere in the ERD

| Screen                  | Data required                                                                                          | Any backing table?                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 11 — WhatsApp Accounts  | number, Meta account ID, connection status, webhook health, quality rating, messages today, last event | **No**                                                                   |
| 12 — Message Monitoring | message id, tenant, direction, customer identifier, status, latency, timestamp                         | **No**                                                                   |
| 08/10 — AI Usage        | requests, input/output tokens per day, cost, error rate, per-tenant usage vs limit, model distribution | **No** (`platform_ai_configurations` stores _limits_, never consumption) |
| 01 — Platform Overview  | MRR, GMV, orders generated, AI resolution rate, message volume, activity feed                          | **No** for GMV / orders / resolution rate / activity feed                |
| 02 — Tenants list       | per-row Messages, Orders, MRR, WhatsApp status, AI status columns                                      | **No**                                                                   |

There is a second, deeper conflict here. `README.md` states the design rule: _"Operational tenant data belongs in each tenant database and must not be introduced into these repositories."_ Screens 11 and 12 are cross-tenant views of exactly that operational data. Screens 01, 02 and 08/10 are cross-tenant aggregates of it. With ~1,240 tenant databases, neither can be served by querying tenant databases at request time (see 6.2).

**Impact.** Modules M9–M12 are **not implementable** as specified. They need either (a) new master-side rollup and registry tables, or (b) a separate analytics store fed by a pipeline. Either is a database-design decision, not an implementation detail.

**Minimum change proposed** — the smallest set of master-side tables that unblocks screens 11, 12, 08/10, 02 and 01, listed for approval, not created:

| Proposed table                                             | Serves                          | Rationale for master-side placement                                                                                     |
| ---------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `whatsapp_accounts`                                        | 11, 02, 04                      | Routing/registry data, not conversation data. One row per number.                                                       |
| `whatsapp_account_health` (or health columns on the above) | 11, 04                          | Webhook status, quality rating, last event — polled, low cardinality                                                    |
| `tenant_usage_daily`                                       | 08/10, 02, 09, 01               | One row per tenant per day: messages in/out, tokens in/out, requests, errors, cost. Bounded: 1,240 × 365 ≈ 452k rows/yr |
| `platform_metrics_daily`                                   | 01                              | One row per day of platform aggregates. Trivially small.                                                                |
| `message_events` **or** an external log store              | 12                              | 450k/day → 164M/yr. Should **not** live in the master Postgres.                                                         |
| `platform_audit_logs`                                      | activity feed on 01, compliance | See 2.3                                                                                                                 |

`message_events` is the one that needs a real architectural decision — see D-11.

### 2.3 Problem 3 (high): no audit trail in the ERD

The BO performs irreversible, regulated actions: approve/reject a tenant, suspend a tenant, edit live plan pricing, rotate the platform AI API key, export bulk data, and **log in as a tenant** (screen 04). The ERD has no audit table. The existing Prisma schema has `PlatformAuditLog` — which is _not_ in the ERD and therefore, under the stated rule, has no authority.

**Impact.** No answer to "who suspended this tenant and when", no evidence for a security incident, and the screen-01 activity feed ("Urban Style BD provisioned successfully", "Enterprise plan upgraded for Fresh Basket") has no data source.

**Minimum change proposed:** add `platform_audit_logs` to the ERD — `id`, `actor_admin_user_id` (nullable FK), `action`, `entity_type`, `entity_id`, `metadata jsonb`, `ip_address`, `occurred_at` — i.e. adopt the existing `PlatformAuditLog` shape. Append-only, no update/delete grants. **Awaiting approval.**

### 2.4 Problem 4 (high): two conflicting authorization models

The ERD contains `admin_users.role` (an enum) **and** a full RBAC triple `admin_roles` / `permissions` / `admin_role_permissions`. There is **no FK from `admin_users` to `admin_roles`**, so the RBAC tables are unreachable from a user. Meanwhile `src/features/auth/permissions.ts` implements a third model: a hard-coded role→permission map over four roles.

**Impact.** Authorization cannot be implemented deterministically. Picking wrong means rewriting every permission check later.

**Minimum change proposed:** keep the RBAC tables as the model of record and add `admin_users.role_id UUID FK → admin_roles.id`; either drop `admin_users.role` or demote it to a denormalised cache. Seed `admin_roles` with the four roles already in code (SUPER_ADMIN, ADMIN, SUPPORT, FINANCE) and `permissions` with the codes in `src/constants/permissions.ts`. **Awaiting approval — see D-01.**

### 2.5 Problem 5 (medium): tenant ↔ registration link is missing

Screen 04 shows `Reg: REG-99281` on an approved **tenant**, but `tenants` has no `registration_id` and `tenant_registrations` has no `tenant_id`. The relationship the UI displays is not modelled.
**Minimum change:** add `tenants.registration_id UUID unique nullable FK → tenant_registrations.id`. Nullable because screens also offer "Create Tenant" directly, bypassing registration. **Resolved — column added**, migration `20260906160000_add_tenant_registration_id`, `ON DELETE SET NULL` so removing an application never removes the live tenant it produced.

### 2.6 Problem 6 (medium): every enum in the ERD is undefined

All 12 enum columns are drawn simply as `enum`, with no members. A migration cannot be written without them. Values evidenced by the screens are proposed in section 8 (D-03); values with no evidence are listed as open.

### 2.7 Problem 7 (medium): `price_snapshot` is NOT NULL but Enterprise pricing is "Custom"

Screen 05 shows Enterprise with price **Custom** and limits **Unlimited**. `plans.monthly_price` is nullable, so the catalogue side works — but `subscriptions.price_snapshot` is non-nullable, so no tenant can ever be subscribed to a Custom plan. **Minimum change:** make `price_snapshot` nullable, or add `negotiated_price` to the subscription. **Awaiting approval — see D-04.**

### 2.8 Problem 8 (medium): plan limits live in `features jsonb`, but the UI treats them as typed and enforced

Screen 05 shows AI Messages / WhatsApp Numbers / Team Members / Storage as numeric limits with `Unlimited` and `Custom` variants, plus boolean toggles. In the ERD these all collapse into `plans.features jsonb`. That means no DB-level validation, no constraint, and no efficient "which plans include X" query — while `platform_ai_configurations.default_tenant_token_limit` implies limits _are_ enforced at runtime.
**Minimum change:** none to the schema; instead pin a **versioned JSON Schema** for `features`, validated with Zod on write, with `null` meaning unlimited. **Awaiting confirmation — see D-05.**

### 2.9 Lower-severity schema findings (no change proposed yet)

| #   | Finding                                                                                                                 | Impact                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| a   | No `updated_at` on `tenants`, `plans`, `subscriptions`, `invoices`                                                      | No optimistic concurrency: two admins editing a plan silently overwrite each other                                    |
| b   | `tenants.owner_email` / `tenant_registrations.owner_email` not unique                                                   | Duplicate registrations and duplicate tenants for the same owner                                                      |
| c   | `tenant_registration_checks.checked_by` is a bare `UUID nullable`, not an FK                                            | Orphan references to deleted admins; no join to show "checked by"                                                     |
| d   | `tenants.approval_status` vs screen-02 badges Active / Trial / Suspended                                                | One column is doing approval _and_ lifecycle. Trial is a subscription state, Suspended is a lifecycle state. See D-06 |
| e   | No indexes specified anywhere in the ERD                                                                                | At 1,240 tenants / 164M messages, index choice is not optional                                                        |
| f   | `platform_ai_configurations` allows many rows with `is_active = true`                                                   | Screen 09 shows exactly one active configuration; nothing enforces it                                                 |
| g   | No invitation-token table, though `admin_users.status` implies an INVITED state                                         | Admin onboarding flow cannot be built                                                                                 |
| h   | `public_pages` / `public_faqs` / `public_site_settings` exist, but no BO screen manages them                            | Public-site content is unmanageable. Out of BO scope for now — flagged                                                |
| i   | Two ERD fields are visually occluded by overlapping boxes (`tenant_databases` last two columns, `invoices` last column) | Read as `created_at` / `updated_at` and one nullable timestamp (likely `paid_at`) — needs confirmation, D-09          |
| j   | No soft-delete or retention columns anywhere                                                                            | GDPR erasure and data retention have no mechanism                                                                     |

### 2.10 Decisions taken while implementing §2.1

The migration could not be written without settling these. Each is transcribed
into a comment in `prisma/schema.prisma` at the point it applies.

| # | Decision taken | Rationale |
|---|---|---|
| **D-03** | All 12 enums given members. Evidenced by the mockups: `tenant_approval_status` (Active/Trial/Suspended/Pending Review), `registration_check_type` (the three checklist items), `billing_cycle` (Monthly/Annual). The other nine use conventional members. | A Postgres enum cannot be created without them. |
| **D-07** | `timestamptz(3)` in place of the ERD's naive `timestamp`. | Tenants span US-East-1, LatAm and +44. A naive timestamp records the wrong instant. Storage-level only; the logical model is unchanged. |
| **D-08** | `decimal(12,2)` on every money column. | Postgres requires an explicit precision; unqualified `numeric` invites drift between columns. |
| **D-09** | `tenant_databases` closes with `created_at` / `updated_at`; `invoices`' occluded final column transcribed as `paid_at timestamp nullable`. | Both are hidden behind overlapping boxes in the source image. **Confirm the `invoices` column name.** |
| — | Indexes and referential actions added (13 FKs, 37 indexes). `RESTRICT` on `subscriptions.plan_id` and `tenant_registrations.requested_plan_id`; `CASCADE` on `tenant_databases.tenant_id` and the RBAC join. | The ERD specifies neither, and at the documented volumes index choice is not optional. |
| — | `tenant_registration_checks` given a unique key on `(tenant_registration_id, check_type)`. | Prevents duplicate checklist rows for one registration. |

Consequences now visible in the running console, all of them faithful to the
ERD rather than worked around:

- **Screen 04 now shows the registration code.** `tenants.registration_id`
  carries the link (§2.5 / D-02, resolved); provisioning sets it, and the
  tenants list cites it under the tenant code. Null — and omitted — for a
  tenant created directly rather than from an application.
- **Screen 03 now shows a real sign-up date.** `tenant_registrations` gained a
  `created_at` column — see **D-34**, resolved. The earliest completed check
  used to stand in, which is null on every unreviewed registration, so a
  brand-new application read "—"; the queue also had no arrival order.
- **Screen 09 shows no key fingerprint.** `secret_reference` is a pointer into
  a secret manager and is never selected into a DTO, so there is nothing to
  fingerprint. This is the correct outcome for S-01.
- **Screens 08/10, 11 and 12 show an explicit "no data source" panel**, and
  screen 01's GMV, AI-messages, WA-messages, orders and resolution-rate tiles
  render as unavailable. Those sources are §2.2, still open.

### 2.11 Product changes made after the mockups

The following were requested directly and diverge from `docs/uiux/bo-site/`.
The mockups are out of date on these points.

| Change | Effect |
|---|---|
| **All fixture data removed** | `src/server/data/mock/` and `src/server/repositories/mock/` are deleted. Nothing in the application fabricates data. The four ports with no tables are served by `src/server/repositories/unavailable/`, which reports *absence* — never zero — so a screen can say "there is no source for this" instead of "there is no activity". |
| **Plan resource limits removed entirely** | `PlanFeatures.limits` is gone, along with the AI Messages / WhatsApp Numbers / Team Members / Storage rows on screen 05 and the whole "Resource Limits" card on screens 06–07. Plans now describe price and capability only. Screen 08/10's "Usage vs Plan Limit" column went with it, since there is no allowance left to compare against. |
| **Tenants list columns trimmed** | AI Status, Messages, Orders and MRR removed from screen 02. Remaining columns: Business / ID, Owner, Plan, WhatsApp, Status, Actions. |
| **Tenants list gained row actions** | Collapsed into a single kebab (three-dot) menu per row: View details, View public site, then status-driven lifecycle items — Approve and Reject when pending review, Suspend when active or trialing, Reactivate when suspended. Transitions are enforced server-side in `decideTenantStatusAction`, not merely by hiding menu items. |
| **`tenants.website_url` added** | Not in the ERD. Nullable `varchar(300)`, migration `20260905090000_add_tenant_website_url`. Backs the "View public site" item, which is disabled with "No site URL on file" when null rather than guessing a URL from the tenant code. |
| **Plan writes wired to Postgres** | `savePlanAction` now persists; `deletePlanAction` added. Delete is refused while a plan has active subscribers, and the `ON DELETE RESTRICT` on `subscriptions.plan_id` / `tenant_registrations.requested_plan_id` is caught and explained rather than surfacing as a foreign-key error. Deactivating remains the way to retire a plan with history. |
| **AI configuration writes wired** | `platform_ai_configurations` is now editable: provider, model, active flag, global token limit, per-tenant default and warning threshold. The **credential is deliberately not editable** — `secret_reference` holds a secret-manager pointer, not a key, and no secret manager is configured (S-01 / D-24). Provider/model pairing is validated server-side. |
| **System Settings made editable** | Backed by `public_site_settings` (brand, contact, announcement), with a versioned jsonb contract in `src/features/system/site-settings.ts` mirroring the `plans.features` approach (D-05). Each key degrades to defaults independently. Maintenance mode and feature flags remain unavailable — no table (§2.1 / D-32). |
| **REST API routes added** | Server Actions remain the UI's path; REST handlers under `src/app/api/` expose the same operations for external callers. Lifecycle and delete rules are shared modules, not duplicated, so the two entry points cannot drift. |

These lifecycle mutations **are audited**. `platform_audit_logs` is not in the
ERD, and was added for this: every tenant decision, registration approve/reject,
plan write, AI configuration change and site-settings change records the actor,
the entity and what changed. Entries are append-only, metadata is scrubbed of
anything credential-shaped, and the write happens inside the shared lifecycle
functions so a new entry point cannot skip it.

### 2.11a Local database

`DATABASE_URL` points at a normal PostgreSQL instance
(`localhost:5432/ws_agent_masterdb`). Migrations, seeding and the shadow
database Prisma needs for `migrate dev` all work there.

Avoid `npm run db:local`. It starts Prisma's bundled wasm Postgres, which
serves a **single database and ignores the database name in the connection
string** (`current_database()` does not match what was requested). Two things
follow: `prisma migrate dev` cannot work, because its shadow database is created
with `CREATE DATABASE` — which clones the one live database and collides on
existing types; and the application's tables end up in `template1`, so every
database subsequently created on that server inherits them. Use the real
Postgres instead.

Verification scripts, both of which restore the state they touch:

- `npm run verify:auth` — credential rejection, sign-in, session persistence.
- `npm run verify:writes` — plan create/update/delete (money precision, currency
  normalisation, `code` immutability), AI configuration persistence including
  the tenant-allocation clear, site settings, and tenant lifecycle transitions.

---

## 2.12 Public site and multi-tenancy

Source: `docs/uiux/public-site/` (six screens plus `DESIGN.md`).

### Design system

The public site does not share the back office's visual language. `DESIGN.md`
specifies Precision-Led Minimalism — 24px cards, charcoal CTAs, emerald reserved
for accents and success, 120px section rhythm, Geist for headings over Inter for
copy. Its tokens are namespaced `--ps-*` alongside the existing set rather than
layered over them, and its primitives live in `src/features/public-site/`
instead of `src/components/ui/`, so retuning one language cannot disturb the
other.

### Pages

| Route | Screen | Data |
|---|---|---|
| `/` | 01 landing | static copy; brand from `public_site_settings` |
| `/how-it-works` | 02 workflow | static |
| `/demo` | 03 automation demo | scripted transcript |
| `/solutions` | 04 industries | static |
| `/pricing` | 05 pricing | **`plans`** |
| `/about` | 06 about | static |
| `/register` | — | writes **`tenant_registrations`** |

Three divergences from the mockups, each deliberate:

- **The annual "-20%" badge is derived, not hard-coded.** A badge promising a
  discount the catalogue does not give is a pricing error, so it is computed
  from the plans and disappears when there is no saving. It currently reads
  -20%, matching the mockup, because the seeded prices happen to give exactly
  that.
- **Prices come from the database, so they are the seeded $99/$299, not the
  mockup's $49/$149.** Editing a plan in the back office moves the public page
  without a deploy; marking one inactive removes it.
- **The nav slot the mockups label "Services" on screen 04 and "Solutions"
  everywhere else** is "Solutions" throughout. Two names for one destination is
  a defect, not a design.

`/register` is not in the mockups but every CTA pointed at it. It closes the
loop the schema already implies: a public application writes a `PENDING_REVIEW`
row with its three review checks and appears on screen 03. No tenant and no
database are provisioned until an administrator approves it.

Two images on screen 06 have no licensed asset in the repo; a brand gradient and
a labelled placeholder stand in, both marked in source for replacement.

### Multi-tenancy: host-based routing

The public site is the platform's own marketing site — `public_pages`,
`public_faqs` and `public_site_settings` carry no `tenant_id`. Multi-tenancy is
therefore implemented as the routing layer `tenant_databases` already implies:
a request on a tenant's host is served from that tenant's own database.

```
acme.example.com
      │
      ▼  proxy.ts (pre-render, no state, may run on a CDN)
   parse host ──► label "acme" ──► x-tenant-label header
      │
      ▼  Node runtime: resolveTenant() (deduped per request)
   tenants.subdomain lookup ──► tenant + tenant_databases row
      │
      ▼  secret provider (port; no adapter in this repo)
   secret_reference ──► credential
      │
      ▼  cached per-tenant PrismaClient
```

Design constraints that shaped it:

- **Host parsing fails closed.** A wrong answer serves one tenant's data on
  another tenant's host, so anything doubtful returns "no tenant" rather than
  "some tenant": nested labels, foreign roots, suffix smuggling
  (`acme.example.com.evil.com`), invalid DNS labels and reserved platform labels
  are all rejected, and an unset `TENANT_ROOT_DOMAIN` disables routing entirely.
- **Tenant headers are unforgeable.** Both are stripped from every inbound
  request before being set, so a client cannot send `x-tenant-label` to a
  platform host and be served another tenant.
- **Resolution is split by runtime because it must be.** The proxy runs before
  rendering and may be deployed to a CDN, so it cannot reach the database; it
  decides only whether a host *looks* tenant-scoped.
- **`tenants.subdomain` is new and not in the ERD.** Routing needs an explicit
  mapping: deriving one from the business name or tenant code breaks on rename
  and cannot guarantee a valid, unique DNS label. Unique at the database level,
  because two tenants on one host is a data-leak class of bug.
- **Credentials stay behind a port.** `secret_reference` is a pointer into a
  secret manager, never the credential (S-03), so resolution is an interface
  whose production implementation fails every lookup rather than degrading. The
  env-backed provider is refused outside development.
- **Pools are cached and bounded.** A `PrismaClient` owns a connection pool, so
  one per request would exhaust Postgres in seconds. Clients are keyed by a
  signature of the target — a rotated secret or moved host invalidates the entry
  rather than serving the old pool — evicted after five idle minutes, capped at
  25.
- A suspended or unprovisioned tenant keeps its host but is not served from it.

**Not yet done.** No tenant database is actually reachable in this environment:
there is no secret manager, so `secret-unavailable` is the expected outcome
today. The layer is complete up to that boundary. Per-tenant storefronts (a
tenant's own products and branding on their host) would need new tables and are
a separate piece of work.

### Verification

| Command | Covers |
|---|---|
| `npm run verify:auth` | credential rejection, sign-in, session persistence |
| `npm run verify:writes` | plan CRUD, AI configuration, site settings, tenant lifecycle |
| `npm run verify:public` | pricing from the catalogue, registration reaching the review queue |
| `npm run verify:tenancy` | 15 host-parsing cases, secret-provider policy, routing lookup |

Each restores the state it touches.

### Provisioning on approval

Signup no longer asks which plan the applicant wants. Choosing a tier before
anyone has verified the business is a decision made at the wrong moment, and the
value was advisory anyway — a reviewer could override it. Everything is now
assigned when a registration is approved on screen 03, in one transaction:

| Assigned | How |
|---|---|
| `tenants.id` | UUID |
| `tenants.tenant_code` | next `TEN-#####` |
| `tenants.subdomain` | derived from the business name, suffixed on collision |
| `tenants.website_url` | `https://{subdomain}.{TENANT_ROOT_DOMAIN}`, null if unset |
| `tenant_databases` | row with derived name and connection *references*, `PENDING` |
| `subscriptions` | first priced active plan, `TRIALING`, price frozen at signup |
| registration status | `APPROVED` |

Decisions worth recording:

- **The tenant starts on TRIAL, not ACTIVE, and its database row is PENDING.**
  Nothing here creates a real database — that is an infrastructure job. Marking
  a workspace active when it has nowhere to store anything would be a claim the
  rest of the console then repeats.
- **All of it commits together or not at all.** A tenant without a database row
  or without a subscription is not half-provisioned, it is broken.
- **Approve is re-checked inside the transaction**, so two reviewers clicking at
  once cannot both provision the same registration. The owner's email is also
  checked, since `tenants` carries no `registration_id` (§2.5 / D-02).
- **Only priced, active plans are eligible.** `subscriptions.price_snapshot` is
  NOT NULL as drawn, so a negotiated "Custom" plan cannot be subscribed at all
  (§2.7 / D-04). Approval fails with an explanation rather than a constraint
  error.
- **A name yielding no usable DNS label is refused** rather than given an
  invented address its owner would not recognise.
- The checklist gate is enforced in the action, not only by disabling the
  button.

### Still open

Nothing provisions an actual tenant database, so `tenant_databases` records the
intent with a secret reference no secret manager can resolve.

Impersonation ("Login as Tenant", screen 04) needs a scoped, audited, revocable
grant that the schema does not model (S-02 / D-12); the control is disabled and
says so.

Export is unimplemented on four screens; those buttons are disabled rather than
inert.

Screen 03's checklist records a **reviewer's** verdict, not an automated one.
`recordCheckAction` writes `checked_by` / `checked_at` and the card says so —
nothing contacts a company registry, a payment processor or Meta, so the
`refreshCheckStatusAction` in the M3 table below remains unbuilt. Claiming an
external system had verified a business would be a fabrication.

`tenant_registrations.owner_email` has no partial unique index, so two
simultaneous applications from one address can both queue. Only one can ever
provision — `tenants.owner_email` is unique — so this is a reviewer seeing two
applications, not a data-integrity fault.

Nothing provisions an actual tenant database. `tenant_databases` records the
intent, with a secret reference no secret manager can resolve; an external
provisioner must create the database and flip the row to `READY` before the
tenant is servable.

---

## 3. Architecture analysis

**Observed stack** (from the repo, no design doc): Next.js 16.3.4 App Router, React 19.2.8, TypeScript strict, Tailwind v4, Prisma 6 + `@prisma/adapter-pg`, Zod 4, react-hook-form, bcryptjs, `server-only` boundaries.

**Layering already established, and to be preserved:**

```
src/app/                             route composition, boundaries, API handlers
src/features/*/                      domain types, schemas, server actions, presentation
src/components/                      ui primitives, shared states, app shell
src/server/services/                 use cases; orchestrate repositories
src/server/repositories/contracts/   persistence ports
src/server/repositories/prisma/      Postgres adapters
src/server/repositories/mock/        offline/test adapters
src/config, src/constants, src/schemas, src/types
```

This is sound and every module below follows it. Notes and gaps:

1. **Next.js 16 specifics.** `middleware.ts` is deprecated and renamed to `proxy.ts` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). Per `AGENTS.md`, the relevant guide under `node_modules/next/dist/docs/` must be read before writing code in each module — this plan does not substitute for that.
2. **Route protection is layout-only today.** `src/app/(bo)/bo/layout.tsx` calls `requireBoAdmin()`. That covers pages but **not** Route Handlers under `src/app/api/`. Any new API route needs its own guard.
3. **No authorization enforcement exists.** `hasPermission()` is defined in `src/server/auth/authorization.ts` and never called. There is no `requirePermission()`.
4. **Per-tenant databases have no connection strategy.** `tenant_databases` implies N Postgres instances; nothing in the repo opens them, and no pooling approach is documented. See 6.3.
5. **No background job / outbox mechanism.** Tenant provisioning (screen 01: "provisioned successfully", `tenant_databases.status`) is long-running and failure-prone. It cannot run inside a Server Action.
6. **No real-time transport.** Screen 12 shows a "Live Feed" indicator; no SSE/WebSocket/polling decision exists.
7. **Two different navigation IAs across the mocks.** Screens 01/06/07/09 use _Dashboard, Tenants, Subscriptions, AI Configuration, System Settings_; screens 03/05/10/11/12 use _Overview, Customers, Commercial, AI & Messaging, Operations, Security, System_. `src/constants/routes.ts` matches neither exactly. One must be chosen — D-31.
8. **Dead code.** `src/server/repositories/mock/*` and `src/server/data/mock/*` are wired to nothing (`repositories/index.ts` exports only Prisma adapters) and there is no test runner installed, so the mocks currently serve no purpose.
9. **Sidebar bug.** `src/components/layout/bo-sidebar.tsx` applies active styling and `aria-current="page"` to _every_ item unconditionally.
10. **No test tooling at all.** `package.json` has no test runner, no assertion library, no Playwright. Every "Testing requirements" section below presumes M1.5 lands first.

---

## 4. API design analysis

**No API design document exists.** Reading the screens, the surface needed is: ~10 list/detail reads with search+filter+pagination, ~14 mutations, 3 export endpoints, 1 live feed, and 1 impersonation grant.

Conventions proposed (consistent with existing code):

- **Reads** → Server Components calling `src/server/services/*`. No HTTP endpoint unless a client component needs it (filters, live feed, exports).
- **Mutations** → Server Actions in `src/features/<domain>/actions/`, returning a discriminated result (`{ ok: true, data } | { ok: false, error }`) as `login-action.ts` already does. Server Actions carry Next's built-in CSRF protection; hand-rolled `POST` handlers do not.
- **Route Handlers** (`src/app/api/`) → only for: exports (streamed files), the message live feed, and any third-party webhook. Each must call its own auth + permission guard.
- **Pagination** → `?limit&offset&search` matching `src/types/repository.ts` for bounded lists; **keyset** for messages (see 6.1).
- **Errors** → never leak driver errors to the client; map to stable codes.

Every endpoint table in section 7 is a **proposal awaiting sign-off**.

---

## 5. Security findings

| #    | Severity     | Finding                                                                                                                                                                            | Required mitigation                                                                                                                                                                                                                              |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S-01 | **Critical** | Screen 09 shows the AI **Secret API Key** masked with a reveal (eye) icon. If reveal returns plaintext to the browser, any BO XSS or a curious admin exfiltrates the platform key. | Key is **write-only**. Never returned by any API, in any form. Remove reveal, or gate behind SUPER_ADMIN + re-authentication + audit entry. Store only `secret_reference` (the ERD is already correct); the secret lives in a KMS/secret manager |
| S-02 | **Critical** | **Login as Tenant** (screen 04) with no supporting model                                                                                                                           | Short-lived, single-use, scoped impersonation grant; audited on issue _and_ on use; revocable; visibly banners the tenant UI; never mints an ordinary tenant session. Requires a new table — D-12                                                |
| S-03 | **Critical** | `tenant_databases` holds host, port, username reference, secret reference, database name for every tenant. Screen 04 displays the database name and instance ID to any admin.      | Treat as crown jewels: never included in list endpoints; detail access permission-gated + audited; `secret_reference` never leaves the server; consider column-level grants                                                                      |
| S-04 | **High**     | No rate limiting or lockout on `/bo/login`. (`bo-auth-service.ts` does do a dummy-hash compare, which correctly avoids user enumeration.)                                          | Per-IP + per-account throttling with exponential backoff; lock after N failures; alert on spikes                                                                                                                                                 |
| S-05 | **High**     | No MFA for platform admins. One compromised BO account = every tenant.                                                                                                             | Mandatory TOTP for all admins, enforced at login. Needs a schema decision — D-13                                                                                                                                                                 |
| S-06 | **High**     | `admin_sessions.revoked_at` exists in the ERD but the current code never reads or writes it; there is no logout action, no revoke-all, no rotation on login                        | Check `revoked_at` on every validation; rotate token on privilege change; revoke all sessions on password change; implement logout                                                                                                               |
| S-07 | **High**     | Screen 12 exposes customer emails and phone numbers across **all** tenants to any admin                                                                                            | Mask PII by default (`j.d***@acme.com`, `+1555*****`); unmask requires a distinct permission and writes an audit entry; PII excluded from exports by default                                                                                     |
| S-08 | **High**     | `Export Data` / `Export Logs` on nearly every screen is an unmonitored bulk-exfiltration channel                                                                                   | Permission-gated, rate-limited, row-capped, fully audited (actor, filter, row count)                                                                                                                                                             |
| S-09 | **Medium**   | Session cookie is `sameSite: lax` with no CSRF token. Fine for Server Actions, **not** for hand-written POST handlers                                                              | Keep mutations in Server Actions; any POST route handler needs origin checks + a CSRF token                                                                                                                                                      |
| S-10 | **Medium**   | `admin_users.email varchar(190) unique` is case-sensitive in Postgres. `seed.ts` lowercases; `login-action` does not                                                               | Normalise to lowercase at every boundary, or use `citext`                                                                                                                                                                                        |
| S-11 | **Medium**   | Webhook health is displayed (screen 11) but no webhook ingestion, signature verification or replay/dedup model exists                                                              | Verify Meta signatures, store `event_id` for idempotency, reject stale timestamps                                                                                                                                                                |
| S-12 | **Medium**   | No password policy, no rotation, no invitation-token model despite an `INVITED` admin status                                                                                       | Minimum length + breach-list check; signed, expiring, single-use invitation tokens                                                                                                                                                               |
| S-13 | **Medium**   | No authorization checks anywhere in the running code — `hasPermission()` is never called                                                                                           | `requirePermission()` at every page, action and route handler; deny by default                                                                                                                                                                   |
| S-14 | **Low**      | Sessions have no absolute lifetime cap; "remember me" grants 30 days (`src/server/auth/session.ts`)                                                                                | Idle timeout + absolute cap; 30 days is long for a platform-admin console                                                                                                                                                                        |

---

## 6. Scalability findings

Volumes read from the mocks: **1,240 tenants**, **1,432 WhatsApp accounts**, **450k messages/day**, **1.2M AI messages/month**, **850M input tokens/month**.

| #    | Finding                                                                                                               | Consequence                                                                      | Direction                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P-01 | Offset pagination with a total count on every list (screens 02, 11, 12 all show "Showing X of N" plus numbered pages) | `COUNT(*)` per page load. Tolerable at 1,432 accounts, fatal at 164M messages/yr | Keep offset for tenants/accounts; **keyset** for messages; approximate counts (`reltuples`) above a threshold                     |
| P-02 | Cross-tenant aggregates (screens 01, 02, 08/10) over per-tenant databases                                             | Fan-out of 1,240 queries per page load. Not viable                               | Pre-aggregate into master-side daily rollups (`tenant_usage_daily`, `platform_metrics_daily` — 2.2). Dashboards read only rollups |
| P-03 | One Postgres instance per tenant                                                                                      | Connection-pool exhaustion: 1,240 DBs × pool size ≫ any `max_connections`        | External pooler (PgBouncer/RDS Proxy), lazy per-tenant connections, LRU eviction, hard per-request cap                            |
| P-04 | Screen 12 "Live Feed" with no transport defined                                                                       | Naive polling × concurrent admins × 450k msgs/day is a self-inflicted load spike | SSE with server-side throttling and a bounded window; never "select all recent messages"                                          |
| P-05 | Token-limit enforcement (`global_token_limit`, `default_tenant_token_limit`)                                          | Enforcing via `SUM()` on the hot path is O(rows) per AI request                  | Atomic counters in Redis (or equivalent), periodically reconciled against `tenant_usage_daily`                                    |
| P-06 | Message log retention undefined                                                                                       | 164M rows/yr in one table; queries and backups both degrade                      | Time-partition monthly + retention policy, or move to a log store (D-11)                                                          |
| P-07 | Exports are unbounded                                                                                                 | A single click can pull millions of rows and pin a connection                    | Async export jobs with row caps and streamed output; never inline in a request                                                    |
| P-08 | No caching strategy for dashboards                                                                                    | Every visit recomputes identical aggregates                                      | Cache rollup reads with an explicit revalidation window; document the staleness contract on-screen                                |
| P-09 | `plans.features` is jsonb                                                                                             | "Which plans include Analytics?" becomes a full scan                             | Acceptable at plan volumes (<100); revisit only if entitlement queries appear                                                     |

---

## 7. Modules

Legend: **⛔ Blocked** = cannot start until a section-8 decision lands. Dependencies are module IDs.

Cross-cutting rules for every module: read the relevant guide under `node_modules/next/dist/docs/` before writing code (per `AGENTS.md`); no `any`; Zod at every boundary; `server-only` on server modules; repository port before Prisma adapter; deny-by-default authorization; `npm run lint && npm run typecheck && npm run build` clean.

---

### M0 — Schema reconciliation ⛔ **BLOCKS EVERYTHING**

**Objective.** Bring `prisma/schema.prisma` into exact correspondence with the approved ERD, on one migration, with seed and repositories ported.

**Backend work.** Port `prisma/seed.ts`; port the five adapters in `src/server/repositories/prisma/`; update `src/features/*/types.ts` and `src/types/status.ts` to the ERD's enum members; update `src/server/repositories/prisma/mappers.ts`.

**Database work.** All 18 ERD tables with ERD names, types, lengths, nullability; `@@map`/`@map` for snake_case; UUID primary keys; the approved deltas from 2.1 (timestamptz, decimal precision); the approved additions from 2.3–2.5 (audit log, `admin_users.role_id`, `tenants.registration_id`); FK actions decided per relation (`RESTRICT` on `subscriptions.plan_id` so a plan with subscribers cannot be deleted; `CASCADE` on `tenant_databases.tenant_id`); indexes for every FK plus the filters visible on screens 02, 11, 12.

**API endpoints.** None.

**Frontend work.** None.

**Validation.** `prisma validate`; `prisma migrate diff` empty against the new baseline; seed runs clean twice (idempotent).

**Auth/authorization.** Migration credentials are not application credentials. The app role gets no DDL rights and no DELETE on `platform_audit_logs`.

**Error handling.** Migration runs in a transaction; documented rollback; `db:migrate` must fail loudly on drift.

**Testing.** Schema snapshot test; seed idempotency test; one round-trip test per repository.

**Dependencies.** Decisions D-00 … D-09.

**Completion criteria.** Fresh database from migrations matches the ERD field-for-field; seed succeeds; `npm run lint && npm run typecheck && npm run build` pass; login and dashboard still work.

---

### M1 — Design system & application shell

**Objective.** Implement the `DESIGN-bo-admin.md` token set and the primitives every screen reuses.

**Backend work.** None.

**Database work.** None.

**API endpoints.** None.

**Frontend work.** Map the design-doc tokens into `src/app/globals.css` (`@theme inline`) — the current palette is a generic shadcn set and does not match the doc. Wire Inter + JetBrains Mono. Primitives: `DataTable` (sticky header, row hover, dense cells, sortable, bulk-select checkbox column, empty/loading/error states), `StatusBadge` (pill, 10% tint background per `DESIGN-bo-admin.md`), `MetricCard` (label above value, optional delta chip, optional sparkline), `Sparkline`, `Pagination`, `FilterBar`, `Tabs` (underline + pill-toggle variants), `Modal`, `ConfirmDialog`, `Toast`, `PageHeader`, `Breadcrumbs`, `CopyableField` (screen 04 UUID/DB name), `EmptyState` (exists), `LoadingState` (exists). Fix the sidebar active-state bug (§3.9). Collapsible 240px/64px sidebar. Responsive rules from the design doc (mobile <768 one column, tablet 6-col, desktop 12-col) — **note: no mobile mock exists**, see D-14.

**Validation.** N/A.

**Auth/authorization.** N/A (presentational only).

**Error handling.** Every data primitive renders explicit loading / empty / error states — none of the 12 mocks show these.

**Testing.** Component tests per primitive; axe accessibility pass; keyboard navigation on table + pagination; visual check against the mocks at 1440px.

**Dependencies.** M1.5 for tests.

**Completion criteria.** Tokens match `DESIGN-bo-admin.md` exactly; every primitive covers loading/empty/error; no hard-coded hex values in feature code.

---

### M1.5 — Test & quality infrastructure

**Objective.** There is currently no way to test anything. Fix that first.

**Backend work.** Install and configure a test runner (Vitest) + React Testing Library + Playwright for E2E. A disposable Postgres for integration tests. Wire `test`, `test:watch`, `test:e2e` scripts. Point the existing `src/server/repositories/mock/*` adapters at unit tests so they stop being dead code.

**Database work.** Ephemeral test database with migrations applied per run.

**API endpoints.** None.

**Frontend work.** Test utilities: render-with-session helper, fixtures.

**Validation.** CI runs `lint`, `typecheck`, `build`, `test`.

**Auth/authorization.** Test session factory for each of the four roles.

**Error handling.** CI fails on any failing test; no skipped tests merged.

**Testing.** Self-verifying.

**Dependencies.** None.

**Completion criteria.** `npm test` runs green; one example unit, integration and E2E test each pass in CI.

---

### M2 — Admin identity, sessions & RBAC

**Objective.** Harden the existing login and make authorization real. Backs every screen's chrome (avatar menu, permission-gated nav).

**Backend work.** Extend `BoAuthService`: lowercase-normalise email, rate limiting + lockout (S-04), session-token rotation, `revoked_at` handling, logout, revoke-all-sessions, capture `ip_address` + `user_agent` (ERD columns). Replace the hard-coded map in `src/features/auth/permissions.ts` with permissions loaded from `admin_roles`/`permissions`/`admin_role_permissions` (per D-01), cached per request. Add `requirePermission(permission)` beside `requireBoAdmin()`. Add `proxy.ts` for coarse unauthenticated redirects (the layout guard remains authoritative). MFA per D-13. Admin invitation flow per 2.9g.

**Database work.** No new tables beyond M0 (assumes 2.4 approved). Index `admin_sessions(token_hash)`, `(admin_user_id)`, `(expires_at)`. Expired-session sweeper.

**API endpoints.**

| Method | Path / Action             | Purpose                           |
| ------ | ------------------------- | --------------------------------- |
| Action | `loginAction`             | Authenticate (exists — to harden) |
| Action | `logoutAction`            | Revoke current session            |
| Action | `revokeAllSessionsAction` | Revoke all sessions for an admin  |
| Action | `verifyMfaAction`         | TOTP step (D-13)                  |
| GET    | `/api/health`             | Liveness (exists)                 |

**Frontend work.** Login screen exists (`src/features/auth/components/`) — restyle to M1 tokens; MFA step; avatar menu with logout; permission-filtered `BO_NAVIGATION` (currently one hard-coded item); 403 page using Next's `forbidden.md` convention.

**Validation.** Zod: email (lowercased, valid), password (present, ≤ bounded length), rememberMe boolean, TOTP 6 digits. Never reveal which factor failed.

**Auth/authorization.** This module _is_ the mechanism. Deny by default; `requirePermission` on every page, action and route handler.

**Error handling.** Single generic message for all credential failures; distinct handling for locked-out and MFA-required; log the reason server-side only; never leak whether an email exists.

**Testing.** Unit: permission resolution per role; session expiry/revocation. Integration: login, lockout after N attempts, logout revokes, expired session rejected. E2E: full login → dashboard → logout. Security: enumeration timing, CSRF on actions.

**Dependencies.** M0, M1, M1.5. Decisions D-01, D-13.

**Completion criteria.** Every BO route enforces a permission; sessions revocable; lockout demonstrable; no plaintext secret or hash ever leaves the server.

---

### M3 — Tenant registration & review (screen 03)

**Objective.** Review, approve or reject inbound tenant registrations with an enforced checklist.

**Backend work.** `RegistrationService`: list with status filter; detail with checks and requested plan; `runCheck` / `recordCheck`; `approve` (guarded by "all checks passed" — the rule stated on screen 03), which creates the `tenants` row, links `registration_id` (D-02), and **enqueues** provisioning (M5); `reject` with a mandatory reason. `RegistrationRepository` port + Prisma adapter. Every transition writes an audit entry.

**Database work.** `tenant_registrations`, `tenant_registration_checks` (M0). Index `(status)`, `(registration_code)`, `(tenant_registration_id)`. `checked_by` as a real FK (2.9c). Enum values per D-03.

**API endpoints.**

| Method | Path / Action                             | Purpose                                        | Permission       |
| ------ | ----------------------------------------- | ---------------------------------------------- | ---------------- |
| —      | Server Component `/bo/registrations`      | List pending registrations                     | `tenants:read`   |
| —      | Server Component `/bo/registrations/[id]` | Review detail (screen 03)                      | `tenants:read`   |
| Action | `recordCheckAction`                       | Set a checklist item's outcome                 | `tenants:manage` |
| Action | `recordCheckAction`                       | Records a reviewer verdict on one checklist item | `tenants:manage` |
| Action | `refreshCheckStatusAction`                | Automated re-check against an external system — **not built**, no such system exists | `tenants:manage` |
| Action | `approveRegistrationAction`               | Approve → create tenant → enqueue provisioning | `tenants:manage` |
| Action | `rejectRegistrationAction`                | Reject with reason                             | `tenants:manage` |

**Frontend work.** Screen 03 exactly: breadcrumbs, status pill, ID + Reg code, Approve / Reject / overflow menu, owner + applied plan + signup date card, Business Details (industry, region, WhatsApp Business API), Review Checklist with "N/3 Complete" chip, per-item state (pass / pending with amber highlight + "Check Status"), the "All checks must pass before final approval" notice. Approve disabled with a tooltip until complete. Reject opens a reason modal.

**Validation.** Reject reason required, 10–500 chars. Approve rejected server-side if any check is not passed — the button being disabled is not a control. Idempotency key on approve to prevent double-provisioning.

**Auth/authorization.** Read `tenants:read`; mutations `tenants:manage`. SUPPORT is read-only.

**Error handling.** Approving an already-approved registration returns a stable conflict, not a 500. Provisioning enqueue failure must **not** leave the registration approved with no tenant — one transaction plus an outbox row. External check-status failure degrades to "unavailable", never blocks the page.

**Testing.** Unit: the all-checks-passed guard; state machine legality. Integration: approve creates tenant + audit + outbox row atomically; reject requires a reason; double-approve is idempotent. E2E: review → complete checks → approve → tenant appears in M4.

**Dependencies.** M0, M1, M2, M13 (audit), M5 (provisioning). Decisions D-02, D-03.

**Completion criteria.** Screen 03 fully functional; approval impossible with an incomplete checklist even via a direct action call; every transition audited.

---

### M4 — Tenant directory (screen 02)

**Objective.** Searchable, filterable, paginated list of all tenants.

**Backend work.** Extend `TenantRepository` (currently `findById` / `findMany` / `count`) with search over business name / tenant code / owner email, and filters for status, plan, WhatsApp state. `TenantListService` joining the current subscription for the Plan and MRR columns. **The Messages / Orders / MRR / WhatsApp / AI-status columns must read from master-side rollups (2.2), never fan out to tenant databases (P-02).**

**Database work.** Indexes: `tenants(approval_status)`, `tenants(tenant_code)`, `tenants(business_name)` (trigram if fuzzy search is wanted), `subscriptions(tenant_id, status)`. Requires `tenant_usage_daily` + `whatsapp_accounts` (2.2, ⛔ pending approval) for five of the columns.

**API endpoints.**

| Method | Path / Action                                                           | Purpose          | Permission       |
| ------ | ----------------------------------------------------------------------- | ---------------- | ---------------- |
| —      | Server Component `/bo/tenants?search&status&plan&whatsapp&limit&offset` | Tenant list      | `tenants:read`   |
| GET    | `/api/bo/tenants/export`                                                | CSV export (M14) | `tenants:export` |

**Frontend work.** Screen 02: filter bar (search, Status, Plan, WhatsApp selects, Clear), table with select-all + per-row checkbox, avatar initials chip, Business/ID two-line cell, owner email in mono, plan badge, WhatsApp status icon, AI status dot, right-aligned mono numerics, status pill, `Showing X to Y of N`, numbered pagination. Filters in the URL so views are shareable. Bulk-action bar appears on selection — **no bulk action is specified in any mock**, see D-15.

**Validation.** Clamp `limit` (max 100); `offset` non-negative; reject unknown filter values; search trimmed and length-capped.

**Auth/authorization.** `tenants:read`. Export needs its own permission (S-08).

**Error handling.** Empty search → distinct empty state, not "no tenants". Rollup-backed columns render "—" plus a staleness note when rollups are missing, rather than failing the page.

**Testing.** Unit: filter→query mapping. Integration: pagination boundaries, filter combinations, injection-safe search. E2E: filter, paginate, open a tenant. Performance: p95 under 300ms at 1,240 rows.

**Dependencies.** M0, M1, M2; M7 (plan/MRR), M9 + M10 (rollups). **⛔ Five columns blocked on 2.2.**

**Completion criteria.** All ERD-backed columns live; rollup-backed columns either live or explicitly degraded; filters shareable via URL; export audited.

---

### M5 — Tenant detail, provisioning & lifecycle (screen 04)

**Objective.** Full tenant record, infrastructure status, and lifecycle actions (suspend, impersonate).

**Backend work.** `TenantService`: detail with registration, subscription, database registry; `suspend` / `reactivate` / `archive` with reason + audit; `provisionTenant` as an **idempotent background job** driven from an outbox, moving `tenant_databases.status` PENDING → PROVISIONING → READY/FAILED, with retry, backoff and a dead-letter path; `issueImpersonationGrant` (S-02). Requires a job runner — see D-16.

**Database work.** `tenant_databases` (M0). Impersonation grant table (⛔ D-12). Outbox/job table (⛔ D-16). Index `tenant_databases(tenant_id)` unique, `(status)`.

**API endpoints.**

| Method | Path / Action                       | Purpose                  | Permission                          |
| ------ | ----------------------------------- | ------------------------ | ----------------------------------- |
| —      | Server Component `/bo/tenants/[id]` | Detail (screen 04)       | `tenants:read`                      |
| Action | `suspendTenantAction`               | Suspend with reason      | `tenants:manage`                    |
| Action | `reactivateTenantAction`            | Reactivate               | `tenants:manage`                    |
| Action | `retryProvisioningAction`           | Retry a FAILED provision | `tenants:manage`                    |
| Action | `impersonateTenantAction`           | Issue a scoped grant     | `tenants:impersonate` (SUPER_ADMIN) |

**Frontend work.** Screen 04: header with status pill, ID + Reg code, `Login as Tenant`, `Suspend`, overflow. Registration & Technical card with copyable UUID and database name. Owner + applied plan + signup date. Business Details. Infrastructure Status panel: WhatsApp Integration (number, status, webhook), AI Engine (agent, resolution %), Database Instance (status, ID, last backup). Provisioning progress + retry for PENDING/PROVISIONING/FAILED — **no mock exists for these states**, see D-17. Suspend opens a confirm dialog with a reason.

**Validation.** Suspend reason required. Legal state transitions enforced server-side. Impersonation grants expire in minutes and are single-use.

**Auth/authorization.** Detail `tenants:read`; lifecycle `tenants:manage`; impersonation restricted to SUPER_ADMIN with re-authentication. Database credentials **never** reach the client (S-03); `database_name` display is itself a decision — D-18.

**Error handling.** Failed provisioning surfaces the reason and a retry, never a blank panel. Infrastructure Status is best-effort: each sub-panel degrades independently. Suspending an already-suspended tenant is a no-op conflict, not a 500.

**Testing.** Unit: transition legality; grant expiry. Integration: provisioning idempotency under retry; suspend writes audit; credentials absent from every response payload. E2E: detail → suspend → confirm → status updates. Security: impersonation grant cannot be replayed or extended.

**Dependencies.** M0, M1, M2, M3, M13. Decisions D-12, D-16, D-17, D-18. **⛔ Infrastructure Status depends on 2.2.**

**Completion criteria.** Detail matches screen 04; provisioning is idempotent and observable; impersonation is time-boxed, single-use and audited; no credential ever crosses the server boundary.

---

### M6 — Plan catalogue (screens 05, 06, 07)

**Objective.** Create, edit, order and (de)activate subscription plans.

**Backend work.** `PlanService`: list ordered by `sort_order`; create; update; toggle active; reorder. Validate `features` against the versioned JSON Schema (2.8 / D-05). Guard: a plan with active subscriptions cannot be deactivated or deleted without an explicit migration path (D-19). Every mutation audited with a before/after diff.

**Database work.** `plans` per the ERD (M0): nullable `monthly_price` / `annual_price` decimal (supports "Custom"), `features` jsonb, `sort_order`, `is_active`. Index `(is_active, sort_order)`, unique `(code)`. **Not in the ERD but shown in the UI:** the accent-colour swatch (screen 06) and the `POPULAR` badge (screen 05) — D-20.

**API endpoints.**

| Method | Path / Action                          | Purpose                         | Permission     |
| ------ | -------------------------------------- | ------------------------------- | -------------- |
| —      | Server Component `/bo/plans`           | Plan cards (screen 05)          | `plans:read`   |
| —      | Server Component `/bo/plans/new`       | Create form (screen 06)         | `plans:manage` |
| —      | Server Component `/bo/plans/[id]/edit` | Edit form (screen 07)           | `plans:manage` |
| Action | `createPlanAction`                     | Create                          | `plans:manage` |
| Action | `updatePlanAction`                     | Update (optimistic concurrency) | `plans:manage` |
| Action | `togglePlanActiveAction`               | Active ↔ Draft                  | `plans:manage` |
| Action | `reorderPlansAction`                   | Change `sort_order`             | `plans:manage` |

**Frontend work.** Screen 05: three-up cards, price + `/mo`, limit rows with icons and mono values (`Unlimited` / `Custom` as text), feature toggles, ACTIVE / POPULAR badges, highlighted popular card, Edit Plan per card, Create Plan CTA. Screen 06: Active/Draft segmented control, Cancel / Save Plan, Basic Information, monthly + annual price with the "Save 20%" hint, colour swatches, Features Included. Screen 07: two-column with Pricing and Status & Visibility panels, features one-per-line textarea, Save Changes.

**Validation.** Zod: name 2–120; description ≤ 2000; prices non-negative decimals, nullable for Custom; currency ISO-4217; `code` unique, slug-shaped, immutable after creation (D-21); `sort_order` integer; features validated against the schema; annual < 12× monthly when both present (the UI asserts "Save 20%"). Reject on-screen "Unlimited"/"Custom" strings in numeric fields — encode as `null`.

**Auth/authorization.** Read `plans:read`; mutate `plans:manage`. SUPPORT read-only; FINANCE read-only per the current map.

**Error handling.** Duplicate `code` → field-level error, not a 500. Concurrent edits → conflict surfaced with a reload prompt (needs `updated_at`, 2.9a). Deactivating a plan with active subscribers → explicit blocked message naming the count.

**Testing.** Unit: features-schema validation; price rules; Custom/Unlimited encoding. Integration: create/update/reorder round-trip; duplicate code; deactivation guard; audit diff written. E2E: create → appears on screen 05 → edit → save. Regression: editing a plan does **not** change `price_snapshot` on existing subscriptions.

**Dependencies.** M0, M1, M2, M13. Decisions D-05, D-19, D-20, D-21.

**Completion criteria.** Screens 05/06/07 functional; existing subscribers unaffected by catalogue edits; every change audited with a diff.

---

### M7 — Subscriptions & invoices

**Objective.** Back the Plan / MRR columns (screen 02), the MRR KPI and growth chart (screen 01), and the `subscriptions` + `invoices` tables the ERD defines. **No dedicated screen exists** — see D-22.

**Backend work.** `SubscriptionService`: current subscription per tenant; create on tenant approval with `price_snapshot` + `currency` + `billing_cycle` captured at signup; change plan; cancel (`cancelled_at`); period rollover. `InvoiceService`: list and detail. MRR normalisation: annual → monthly, mixed currencies handled per D-23.

**Database work.** `subscriptions`, `invoices` (M0). Indexes `subscriptions(tenant_id, status)`, `(plan_id)`, `(current_period_end)`; `invoices(tenant_id)`, `(subscription_id)`, `(status, due_at)`, unique `(invoice_number)`. Nullable `price_snapshot` per D-04.

**API endpoints.**

| Method | Path / Action                        | Purpose                     | Permission             |
| ------ | ------------------------------------ | --------------------------- | ---------------------- |
| —      | Server Component `/bo/subscriptions` | List (D-22)                 | `subscriptions:read`   |
| Action | `changeSubscriptionPlanAction`       | Move a tenant between plans | `subscriptions:manage` |
| Action | `cancelSubscriptionAction`           | Cancel                      | `subscriptions:manage` |

**Frontend work.** No mock; consume via M4 and M12 only until D-22 is answered.

**Validation.** Period end after start; plan must be active to subscribe; price snapshot immutable once set; invoice `total = subtotal + tax` enforced.

**Auth/authorization.** `subscriptions:read` / `subscriptions:manage`; FINANCE has both in the current map. Invoices need `billing:read`.

**Error handling.** Missing subscription renders "No plan", not a crash. Currency mismatch between plan and subscription is a hard error at write time, not a silent coercion.

**Testing.** Unit: MRR normalisation across billing cycles; invoice arithmetic. Integration: plan change preserves history; cancel sets `cancelled_at`; period boundaries. Property: MRR sum equals the sum of parts.

**Dependencies.** M0, M6. Decisions D-04, D-22, D-23.

**Completion criteria.** MRR is computed identically on screens 01 and 02; price snapshots survive plan edits; invoice totals reconcile.

---

### M8 — AI providers, models & global configuration (screen 09)

**Objective.** Manage the platform AI provider, model, credential reference and token-allocation policy.

**Backend work.** `AiConfigurationService`: read the active configuration **without the secret**; update provider/model; rotate the credential (write-only, stores only `secret_reference`, secret goes to the secret manager); update `global_token_limit`, `default_tenant_token_limit`, `warning_threshold_percent`, and the tenant-allocation toggle. Provider/model catalogue from `ai_providers` / `ai_models`. All mutations audited; credential rotation additionally alerted.

**Database work.** `ai_providers`, `ai_models`, `platform_ai_configurations` (M0). Add a partial unique index so at most one row has `is_active = true` (2.9f). `secret_reference` never selected into any DTO.

**API endpoints.**

| Method | Path / Action                      | Purpose                 | Permission                                |
| ------ | ---------------------------------- | ----------------------- | ----------------------------------------- |
| —      | Server Component `/bo/ai-settings` | Screen 09               | `settings:read`                           |
| Action | `updateAiProviderAction`           | Provider + model        | `settings:manage`                         |
| Action | `rotateAiCredentialAction`         | Write-only key rotation | `settings:manage` + SUPER_ADMIN + re-auth |
| Action | `updateTokenLimitsAction`          | Limits and threshold    | `settings:manage`                         |

**Frontend work.** Screen 09: Provider Settings (provider select, masked key input, model name), Save Changes / Edit Configuration; AI Allocation & Token Limits (global limit, Tenant-Level Allocation toggle, Current Usage Monitoring bar `450,000 / 1,000,000`, Default Tenant Limit, Warning Threshold %). **The reveal (eye) icon must not return the plaintext key** (S-01) — either remove it, or show only a last-4 fingerprint. See D-24.

**Validation.** Limits positive integers within a bounded range; `default_tenant_token_limit ≤ global_token_limit`; threshold 1–99; model must belong to the selected provider and be active; credential validated against the provider before activation.

**Auth/authorization.** Read `settings:read`; writes `settings:manage`; rotation SUPER_ADMIN-only with re-authentication and an audit entry.

**Error handling.** Failed credential validation leaves the previous configuration active — never a half-applied state. Provider outage during validation is distinguished from an invalid key.

**Testing.** Unit: limit invariants; provider/model pairing. Integration: rotation never persists plaintext and never returns the secret in any response; only one active configuration can exist. Security: assert the secret is absent from every serialized payload and from logs.

**Dependencies.** M0, M1, M2, M13. Decision D-24. Current-usage bar depends on M9 (⛔ 2.2).

**Completion criteria.** Screen 09 functional; no plaintext credential is ever returned or logged; single-active-configuration invariant enforced in the database.

---

### M9 — AI usage & cost analytics (screens 08 / 10) ⛔

**Objective.** Cross-tenant AI cost and consumption reporting.

**⛔ Blocked.** No usage table exists in the ERD (2.2). Every figure on these screens — estimated cost, requests, avg cost/conversation, input tokens, error rate, token usage over time, model distribution, per-tenant usage vs plan limit — has no source. Requires approval of `tenant_usage_daily` (+ a model-level breakdown for the distribution donut) and an ingestion pipeline.

**Backend work (once unblocked).** Ingestion writing per-request usage; a daily rollup job into `tenant_usage_daily`; `UsageAnalyticsService` for the KPI row, the in/out token series, model distribution, cost trend and the per-tenant table; cost computed from a per-model rate card (**not in the ERD** — D-25). Redis counters for live limit enforcement (P-05).

**Database work.** `tenant_usage_daily` (tenant_id, day, model_id, requests, tokens_in, tokens_out, errors, cost) with a unique key and time-based partitioning; `platform_metrics_daily`. All ⛔ pending approval.

**API endpoints.**

| Method | Path / Action                          | Purpose       | Permission     |
| ------ | -------------------------------------- | ------------- | -------------- |
| —      | Server Component `/bo/usage?timeframe` | Screens 08/10 | `usage:read`   |
| GET    | `/api/bo/usage/export`                 | CSV export    | `usage:export` |

**Frontend work.** Screen 10 (screen 08 is the same page cropped): five KPI cards with delta chips, stacked in/out bar chart with a timeframe selector, model distribution donut with percentages, cost trend sparkline, Tenant Usage table with a usage-vs-limit progress bar that turns red past the warning threshold and shows a warning icon at 95%. Follow the `dataviz` conventions.

**Validation.** Timeframe from a fixed allow-list; percentages 0–100; cost formatted to the configured currency; explicit staleness indicator ("as of …") since data is rolled up, not live (P-08).

**Auth/authorization.** `usage:read`; export separately permissioned.

**Error handling.** Missing rollups for a day render a gap in the series, never zero — zero and unknown must be visually distinct.

**Testing.** Unit: rollup arithmetic; cost from the rate card; threshold colour boundaries. Integration: rollup idempotency on re-run; partition boundaries. Performance: dashboard under 500ms over 12 months of rollups.

**Dependencies.** M0, M1, M2, M8. **⛔ 2.2, D-25.**

**Completion criteria.** Every figure traces to a rollup row; no query touches a tenant database; staleness visible on-screen.

---

### M10 — WhatsApp account health (screen 11) ⛔

**Objective.** Cross-tenant registry and health view of WhatsApp Business API connections.

**⛔ Blocked.** No table exists for WhatsApp accounts, Meta account IDs, webhook health or quality ratings (2.2). `WhatsappRoutingMetadata` in the current Prisma schema is not in the ERD and carries none of these fields.

**Backend work (once unblocked).** `WhatsappAccountService`: list with search + connection filter; health polling or webhook-driven updates; recording quality-rating changes from Meta; reconnect/re-auth initiation. Webhook signature verification and event deduplication (S-11).

**Database work.** `whatsapp_accounts` (tenant_id, phone_number, meta_account_id, display_name, status, webhook_status, webhook_latency_ms, quality_rating, last_event_at) plus a daily message counter from M9's rollups. Indexes on `(tenant_id)`, `(status)`, `(meta_account_id)` unique. ⛔ pending approval.

**API endpoints.**

| Method | Path / Action                                                  | Purpose                | Permission                          |
| ------ | -------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| —      | Server Component `/bo/whatsapp?search&connection&limit&offset` | Screen 11              | `whatsapp:read`                     |
| Action | `reconnectAccountAction`                                       | Trigger re-auth        | `whatsapp:manage`                   |
| POST   | `/api/webhooks/whatsapp`                                       | Meta webhook ingestion | Signature-verified, unauthenticated |

**Frontend work.** Screen 11: four KPI cards with sparklines (Connected 1,420 ↑2.4%, Disconnected 12 with "Action Req", Webhook Errors 45 last 24h, Messages Today 450k ↑12%), search + All Connections filter + filter/column-toggle icons, table (per-row icon, Tenant/Business two-line, number, Meta account ID in mono, status pill, webhook health dot with latency, quality chip Green/Yellow/N/A, messages today, relative last-event), Prev/1/2/3/Next pagination over 1,432 accounts.

**Validation.** E.164 phone numbers; Meta account ID format; relative timestamps computed client-side from an ISO value to avoid SSR/client drift.

**Auth/authorization.** `whatsapp:read` / `whatsapp:manage`. The webhook endpoint authenticates by signature only and must be rate-limited.

**Error handling.** A stale health poll shows "last checked N ago", not a false Healthy. Webhook signature failure → 401 and an alert, never a silent accept.

**Testing.** Unit: health-state derivation; quality mapping. Integration: webhook signature verification, replay rejection, dedup. E2E: search, filter, paginate. Load: ingestion at the observed webhook rate.

**Dependencies.** M0, M1, M2, M9 (messages-today counter). **⛔ 2.2.**

**Completion criteria.** Screen 11 functional; webhook ingestion verified and idempotent; health freshness always visible.

---

### M11 — Message monitoring (screen 12) ⛔

**Objective.** Near-real-time cross-tenant message log with failure triage.

**⛔ Blocked on two counts.** (a) No table exists (2.2). (b) It contradicts the stated architecture — per-tenant message data in the master database — and at 450k/day it is 164M rows/year (P-06). This needs an architectural decision, not a table.

**Backend work (once unblocked).** `MessageMonitoringService` over the chosen store: keyset-paginated list, filters (direction, status, tenant), a failed-only view with a count badge, and an SSE feed with server-side throttling (P-04). PII masking by default with an audited unmask (S-07).

**Database work.** Per D-11: either a partitioned `message_events` table with retention, or an external log/analytics store (ClickHouse / OpenSearch / managed logs). Do **not** put 164M rows/yr in the master OLTP database without partitioning and retention. ⛔ pending approval.

**API endpoints.**

| Method | Path / Action                                                  | Purpose            | Permission          |
| ------ | -------------------------------------------------------------- | ------------------ | ------------------- |
| —      | Server Component `/bo/messages?direction&status&tenant&cursor` | Screen 12          | `messages:read`     |
| GET    | `/api/bo/messages/stream`                                      | SSE live feed      | `messages:read`     |
| GET    | `/api/bo/messages/export`                                      | Export Logs        | `messages:export`   |
| Action | `revealCustomerIdentifierAction`                               | Audited PII unmask | `messages:read_pii` |

**Frontend work.** Screen 12: filter bar (Direction / Status / Tenant, Live Feed indicator), All Messages / Failed Messages tabs with a count badge, table (message id mono, tenant, direction with arrow + colour, customer, status pill Delivered/Read/Failed/Queued, latency with `–` when absent, ms-precision timestamp), `Showing 1-5 of 1,204`, prev/next only. Live feed pausable, with a "N new" affordance rather than auto-scrolling under the reader.

**Validation.** Cursor opaque and signed; filters allow-listed; time range mandatory and capped (no unbounded scans); export row cap enforced.

**Auth/authorization.** `messages:read`; PII reveal a separate permission; export separately permissioned, rate-limited and audited (S-07, S-08).

**Error handling.** SSE reconnects with backoff and resumes from the last cursor without duplicates. Store unavailable → explicit banner, never an empty table that reads as "no messages".

**Testing.** Unit: keyset cursor encode/decode; masking rules. Integration: filter combinations; retention/partition pruning; unmask writes an audit entry. Load: SSE with the expected concurrent-admin count. Security: no unmasked PII in exports or logs by default.

**Dependencies.** M0, M1, M2, M13. **⛔ 2.2, D-11.**

**Completion criteria.** Screen 12 functional on the approved store; PII masked by default; every unmask and export audited; live feed stable under reconnection.

---

### M12 — Platform overview dashboard (screen 01)

**Objective.** The landing dashboard: eight KPIs, two charts, and the activity feed.

**Backend work.** `PlatformOverviewService` reading **only** rollups (P-02): tenants and active tenants from `tenants`; MRR from M7; AI/WA message counts, orders, resolution rate and GMV from rollups; MRR growth (actual + projected) and message volume series; activity feed from `platform_audit_logs` (2.3). Cached with an explicit revalidation window (P-08).

**Database work.** No new tables of its own; depends on `platform_metrics_daily`, `tenant_usage_daily` and `platform_audit_logs` (⛔ 2.2, 2.3). **GMV, Orders Generated and AI Resolution Rate have no source at all** — see D-26.

**API endpoints.**

| Method | Path / Action                          | Purpose     | Permission         |
| ------ | -------------------------------------- | ----------- | ------------------ |
| —      | Server Component `/bo/dashboard?range` | Screen 01   | `dashboard:read`   |
| GET    | `/api/bo/dashboard/export`             | Export Data | `dashboard:export` |

**Frontend work.** Replace the current placeholder `DashboardOverview`. Screen 01: title + subtitle + Last-30-Days range picker; 4+4 KPI grid (Total Tenants +12%, Active Tenants, MRR +5%, Platform GMV, AI Messages, WA Messages, Orders Generated, AI Resolution Rate in green); MRR Growth area chart with Actual/Projected legend; Message Volume with AI Engine / WhatsApp legend; Platform Activity timeline with coloured status rings, bold entity names, and `time • source` lines. Follow `dataviz` conventions.

**Validation.** Range from a fixed allow-list; deltas require a comparable prior period or are hidden — never rendered as `+0%` when the prior period is missing.

**Auth/authorization.** `dashboard:read` — the baseline permission every role holds. GMV/MRR may warrant `billing:read` gating (D-27).

**Error handling.** Each KPI and chart degrades independently: one missing rollup must not blank the page. "Projected" must be visually distinct from "Actual" and its method documented (D-28).

**Testing.** Unit: delta arithmetic; projection function. Integration: cache invalidation; partial-data rendering. E2E: load, change range, verify the activity feed. Performance: p95 under 500ms from cache.

**Dependencies.** M0, M1, M2, M4, M7, M9, M10, M13. **⛔ 2.2, D-26.**

**Completion criteria.** Every KPI traces to a source or is explicitly removed pending D-26; no KPI fans out to tenant databases; partial failures degrade per-tile.

---

### M13 — Audit logging & activity feed (cross-cutting) ⛔

**Objective.** Append-only record of every privileged action; source for the screen-01 activity feed.

**⛔ Blocked** on approval of `platform_audit_logs` (2.3).

**Backend work.** `AuditService.record({ actor, action, entityType, entityId, metadata, ip })`, written in the **same transaction** as the action it describes — an audit entry that can fail independently is not an audit trail. A typed action catalogue. A read API with actor/entity/date filters.

**Database work.** `platform_audit_logs` with indexes on `(occurred_at)`, `(actor_admin_user_id)`, `(entity_type, entity_id)`. Application role granted INSERT and SELECT only — no UPDATE, no DELETE. Time-partitioned with a retention policy.

**API endpoints.** Server Component `/bo/audit-logs` (`audit_logs:read`); `GET /api/bo/audit-logs/export` (`audit_logs:export`).

**Frontend work.** No dedicated mock (the sidebar shows Security / Logs and `ROUTES.bo.auditLogs` already exists) — build a filterable table on M1 primitives, plus the screen-01 activity-feed component.

**Validation.** `metadata` must not contain secrets, passwords, tokens or unmasked PII — enforced by a redaction allow-list at write time.

**Auth/authorization.** `audit_logs:read`. No role may delete or edit an entry, including SUPER_ADMIN.

**Error handling.** Audit-write failure aborts the whole transaction. Never "log and continue".

**Testing.** Integration: every mutating action in M3/M5/M6/M8 writes exactly one entry; rollback leaves no orphan entry; redaction holds. Security: assert no UPDATE/DELETE grant exists.

**Dependencies.** M0, M2. **⛔ 2.3.**

**Completion criteria.** Every privileged action audited atomically; entries immutable; activity feed populated from real data.

---

### M14 — Data export (cross-cutting)

**Objective.** The Export Data / Export Logs controls present on nearly every screen.

**Backend work.** Async export jobs (queued, not inline — P-07): accept the current filter set, enforce a row cap, stream CSV to object storage, notify on completion, expire the link. Per-export audit with actor, filters and row count.

**Database work.** An export-jobs table (⛔ D-29) if exports are asynchronous.

**API endpoints.** `POST /api/bo/exports` (create), `GET /api/bo/exports/[id]` (status + signed URL) — each with a resource-specific export permission.

**Frontend work.** Export button → filter confirmation → progress → download. No mock shows this flow (D-29).

**Validation.** Row cap; allow-listed columns; PII excluded unless explicitly permitted (S-07).

**Auth/authorization.** A distinct `*:export` permission per resource; rate-limited per admin (S-08).

**Error handling.** Failed exports are visible and retryable; links expire; a partial file is never served as complete.

**Testing.** Integration: cap enforcement, PII exclusion, audit written, link expiry. Security: no cross-tenant leakage through filters.

**Dependencies.** M1, M2, M13, and the module owning each dataset. Decision D-29.

**Completion criteria.** Exports bounded, audited, permissioned and expiring; no synchronous unbounded export path exists.

---

### M15 — Operational readiness (cross-cutting)

**Objective.** Make the console safe to run in production.

**Backend work.** Structured request logging with correlation IDs and secret redaction; error reporting; extend `/api/health` to a real readiness probe (DB reachable, migrations current); metrics for latency and error rate; graceful shutdown; per-IP and per-session rate limiting.

**Database work.** Connection-pool sizing for the master DB; the per-tenant pooling strategy from P-03 (⛔ D-30).

**API endpoints.** `GET /api/health` (exists, to extend); `GET /api/ready`.

**Frontend work.** Global error boundary (`src/app/error.tsx` exists — add a correlation ID for support), `not-found`, `forbidden` and `unauthorized` pages per Next 16 conventions; a maintenance-mode banner.

**Validation.** All env parsed at the boundary — `src/config/env.ts` already does this; extend for new variables (secret manager, Redis, job runner, export storage).

**Auth/authorization.** Health/readiness must not leak version, schema or topology publicly.

**Error handling.** This module _is_ the error strategy: user-facing messages carry a correlation ID; stack traces never reach the browser.

**Testing.** Integration: readiness fails on a pending migration; secrets redacted from logs. Chaos: DB unavailable → readiness fails and the UI degrades. Load: rate limiter under burst.

**Dependencies.** M0, M2. Decision D-30.

**Completion criteria.** Readiness gates deploys; no secret in any log line; every error surfaces a correlation ID.

---

### Module dependency order

```
M1.5 ─┐
M0 ───┼─► M1 ─► M2 ─┬─► M3 ─► M5 ─┐
      │             ├─► M4 ────────┼─► M12
      │             ├─► M6 ─► M7 ──┘
      │             ├─► M8 ─► M9 ⛔ ─┤
      │             ├─► M10 ⛔ ──────┤
      │             ├─► M11 ⛔ ──────┘
      │             ├─► M13 ⛔ (feeds M3, M5, M6, M8, M11, M12)
      │             ├─► M14
      └─────────────┴─► M15
```

Buildable today on approval of section 2.1 alone: **M0, M1, M1.5, M2, M3, M6, M7** and the ERD-backed parts of **M4** and **M5**.
Blocked until sections 2.2 / 2.3 are decided: **M9, M10, M11, M12, M13**, and nine columns/panels across M4, M5 and M8.

---

## 8. Questions / Decisions Required

Ordered by what blocks the most work. Nothing below is assumed.

### Blocking the first migration (M0)

| #        | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-00** | **Approve or reject the section 2.1 reconciliation.** Specifically: (a) is the ERD authoritative over the committed Prisma schema? (b) may `prisma/migrations/` be regenerated as a single baseline — i.e. does any environment hold data worth keeping? (c) of the 10 Prisma-only models, which are kept and added to the ERD, and which are dropped?                                                                                                                                                                                                                                                      |
| **D-01** | Authorization model (2.4): RBAC tables + `admin_users.role_id`, or the `admin_users.role` enum alone? If RBAC, may we add the missing FK?                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ~~**D-02**~~ | **Resolved: column added.** `tenants.registration_id`, unique, nullable, `ON DELETE SET NULL`. Set by provisioning when an approval creates the tenant. Screen 04 and the tenants list cite it; null for a directly created tenant.                                                                                                                                                                                                                                                                                                                                                                    |
| **D-03** | **Define all 12 enums.** Evidenced by the screens: `tenants.approval_status` → Active / Trial / Suspended (screen 02) + Pending Review (screen 03); `tenant_registration_checks.check_type` → Business Verification / Payment Method Linked / WhatsApp API Approval (screen 03); `subscriptions.billing_cycle` → Monthly / Annual (screen 06). **No evidence at all** for: `admin_users.role`, `admin_users.status`, `tenant_registrations.status`, `tenant_registration_checks.status`, `tenant_databases.status`, `subscriptions.status`, `invoices.status`, `ai_providers.status`, `public_pages.status` |
| **D-04** | `subscriptions.price_snapshot` is NOT NULL, but Enterprise is priced "Custom" (2.7). Make it nullable, or add a negotiated-price field?                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **D-05** | Confirm the versioned JSON Schema for `plans.features` (2.8), including how "Unlimited" and "Custom" are encoded (proposal: `null`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **D-06** | Does `tenants.approval_status` track approval only, or approval _and_ lifecycle (Trial / Suspended)? If both, we need a second column (2.9d)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **D-07** | Confirm `timestamptz` instead of the ERD's `timestamp`. Tenants span US-East-1, LatAm and +44; plain `timestamp` will produce wrong times                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **D-08** | Confirm money precision. Proposal: `decimal(12,2)` for all price/subtotal/tax/total columns. And: is multi-currency actually in scope, or is everything USD?                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **D-09** | Two ERD regions are occluded by overlapping boxes. Confirm `tenant_databases`' last two columns are `created_at` / `updated_at`, and what `invoices`' final nullable-timestamp column is (assumed `paid_at`)                                                                                                                                                                                                                                                                                                                                                                                                |

### Blocking five screens (M9–M12)

| #        | Decision                                                                                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-10** | **Approve the six new tables in 2.2**, or specify an alternative source for screens 01, 02, 08/10, 11 and 12                                                                                                                                   |
| **D-11** | Where does the message log live (screen 12)? 450k/day = 164M rows/yr. Options: (a) partitioned master table + retention, (b) a dedicated analytics store, (c) query tenant DBs on demand and accept the fan-out. What is the retention period? |
| **D-12** | Approve an impersonation-grant table for "Login as Tenant" (S-02). What TTL, and which role may impersonate?                                                                                                                                   |
| **D-13** | Is MFA in scope for platform admins (S-05)? If yes, TOTP secret + recovery codes need schema                                                                                                                                                   |
| **D-25** | AI cost is displayed ($4,200 estimated, $0.03/conversation) but no per-model rate card exists in the ERD. Where do rates come from?                                                                                                            |
| **D-26** | **Platform GMV, Orders Generated and AI Resolution Rate (screen 01) have no data source anywhere.** What produces them?                                                                                                                        |

### Product behaviour (no requirement exists)

| #        | Decision                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-14** | No mobile or tablet mocks exist, but `DESIGN-bo-admin.md` defines breakpoints. Is BO desktop-only, or must we design responsive behaviour ourselves?                                                                 |
| **D-15** | Screen 02 has bulk-select checkboxes but no mock shows a bulk action. Which bulk operations exist?                                                                                                                   |
| **D-16** | Tenant provisioning is long-running. What runs background jobs — an in-process worker, a queue, a scheduler? Nothing exists today                                                                                    |
| **D-17** | No mocks exist for provisioning PENDING / PROVISIONING / FAILED states (screen 04 shows only the healthy case). What should they show, and who can retry?                                                            |
| **D-18** | Should `database_name` and the DB instance ID be visible to every admin (screen 04), or restricted (S-03)?                                                                                                           |
| **D-19** | What happens when a plan with active subscribers is set to Draft? Block, or grandfather existing subscribers?                                                                                                        |
| **D-20** | Screen 06 has an accent-colour picker and screen 05 shows a POPULAR badge — neither exists in `plans`. Add columns, or fold them into `features` jsonb?                                                              |
| **D-21** | `plans.code` is unique and user-facing. Is it auto-derived from the name, and is it immutable after creation?                                                                                                        |
| **D-22** | The sidebar has a Subscriptions entry and `ROUTES.bo.subscriptions` exists, but **no mock**. What does that screen show?                                                                                             |
| **D-23** | Screen 01 shows a single MRR figure in `$` while plans/subscriptions/invoices each carry their own currency. Summing mixed currencies is wrong — is everything USD, or do we need FX rates and a reporting currency? |
| **D-24** | Screen 09's key-reveal (eye) icon: remove it, show only a last-4 fingerprint, or gate it behind SUPER_ADMIN + re-auth + audit? (S-01)                                                                                |
| **D-27** | Should financial KPIs (MRR, GMV) on screen 01 be visible to SUPPORT, or gated behind `billing:read`?                                                                                                                 |
| **D-28** | Screen 01's MRR chart shows "Projected". What is the projection method, and over what horizon?                                                                                                                       |
| **D-29** | Are exports synchronous downloads or async jobs? Async needs a jobs table and a notification path                                                                                                                    |
| **D-30** | What is the per-tenant database connection strategy (P-03)? At 1,240 tenant DBs this is an architecture decision, not a config value                                                                                 |
| **D-31** | **Which navigation IA is correct?** The mocks contain two (§3.7), and `src/constants/routes.ts` matches neither                                                                                                      |
| **D-32** | `public_pages`, `public_faqs` and `public_site_settings` exist in the ERD but no BO screen manages them (2.9h). Is public-site content management in scope?                                                          |
| **D-33** | Are there PRD, System Design and API Design documents that were not committed? If so they supersede the inferences in this plan                                                                                      |
| ~~**D-34**~~ | **Resolved: column added.** `tenant_registrations.created_at`, migration `20260906150000_add_registration_created_at`, backfilled from the earliest completed check. Screen 03 shows the date and the review queue orders newest-first. |

---

## 9. What happens next

**Done.** M0 (schema reconciliation), M1 (design system and shell), and the
ERD-backed parts of M2 – M8 are implemented against Postgres. All 12 back-office
screens render; `lint`, `typecheck`, `build` and `format:check` pass.

**Open, in the order they unblock the most work:**

1. **D-10** — approve the six rollup/registry tables in §2.2, or name another
   source. Until then M9 – M12 stay on mock adapters, and nine columns and
   panels across screens 01, 02, 04 and 09 read "—".
2. **D-11** — decide where the message log lives (164M rows/yr).
3. ~~**D-02**, **D-34**~~ — both resolved; `tenants` and `tenant_registrations`
   now carry the two columns screens 03 and 04 display.
4. **D-04** — `subscriptions.price_snapshot` is NOT NULL, so no tenant can be
   subscribed to a negotiated "Custom" plan.
5. **D-09** — confirm the occluded `invoices` column is `paid_at`.
6. **§2.3 / D-12 / D-13** — audit log, impersonation grants, admin MFA. Every
   privileged action in the console is currently unaudited, including the
   tenant approve / reject / suspend actions now wired up on screen 02.

Plan writes remain deliberately unpersisted: `savePlanAction` validates and
enforces the uniqueness and deactivation guards, then stops, because catalogue
edits change what every subscriber is entitled to and belong with the audit
trail in §2.3.
