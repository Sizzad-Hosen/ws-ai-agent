# Master database — deferred work

Items left out of the MVP on purpose. Each one names the trigger that should
bring it back.

## Partition `webhook_events`

**Status:** not done. Deferred from the master rebuild.

`webhook_events` is the only table with unbounded growth. Every inbound
WhatsApp callback writes one row, and nothing deletes them. At production
volume the table outgrows its indexes and the retry query slows down.

Partition it by `received_at`, one partition per month, with a retention job
that drops partitions older than the retention window.

Do not do this yet. Partitioning changes the primary key, because Postgres
needs the partition key inside it. That breaks the `bigserial` identity and
every foreign key that points at the table. The change is cheap while the table
is empty and expensive later, but it is still wasted work until real traffic
arrives.

**Trigger:** the table passes 10 million rows, or the retry query exceeds 100 ms.

## Confirm the 24 INFERRED columns

**Status:** open. Blocks nothing, but the names are guesses.

Overlapping boxes in `docs/db/Ordivex Master DB Design.png` hide 24 columns.
Their types come from the drawn column width. Their names are proposals.
Search `docs/db/master-db.sql` for `INFERRED`.

The least certain are the four in `whatsapp_accounts`: `quality_rating`,
`messaging_limit_tier`, `provider` and `status`. Only the widths are readable.

**Trigger:** a diagram export without overlaps, or the original SQL.

## Restore real RBAC

**Status:** out of MVP by decision.

`roles`, `permissions`, `role_permissions`, `tenant_user_roles` and
`tenant_user_invitations` are not created. `tenant_users.role` is a flat enum
instead, and the invite lives on `tenant_users.invite_token_hash`.

`requirePermission()` in `src/domain` holds the whole role-to-permission map.
Swapping to table-driven RBAC should touch that one file.

**Trigger:** a customer needs a permission set the four roles cannot express.

## Tables cut from the MVP

`leads` was cut, so the public site has no lead capture. `api_keys`,
`cms_pages`, `contact_messages`, `notification_templates`,
`notification_deliveries`, `announcements`, `announcement_reads`, `coupons`,
`coupon_redemptions`, `support_tickets`, `ticket_messages`, `testimonials`,
`public_faqs`, `newsletter_subscribers` and `media_assets` are also absent.

`public_faqs` previously drove the FAQ page. That content is now static in the
component.

## Keep the schema and the SQL in step

`docs/db/master-db.sql` is the source of truth, not `prisma/schema.prisma`.

After any schema change, run `npm run db:diff`. It applies the SQL file to a
scratch database and compares both catalogs. It must report zero differences.

Objects Prisma cannot express live in `prisma/sql/step4.sql`. The init
migration carries a copy. `scripts/append-step4.sh` re-applies it if the init
migration is ever regenerated.
