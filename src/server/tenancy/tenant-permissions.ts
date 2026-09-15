import type { TenantUserRole } from "@prisma/client";

/**
 * What a tenant's own staff may do inside their workspace.
 *
 * Deliberately separate from `src/constants/permissions.ts`, which grants a
 * platform administrator rights over *every* tenant. These grant nothing
 * across a tenant boundary and never could: a permission is only ever checked
 * after `resolveTenant` and a session lookup inside that tenant, so the answer
 * to "may this user do X" is already scoped to one workspace.
 *
 * Pure, and free of `server-only` and of Prisma's runtime, so the rules can be
 * unit-tested without a database. The lookup that finds a user's role lives in
 * `tenant-context.ts`.
 *
 * The colon separator follows the platform constants rather than the dotted
 * form used elsewhere, so both halves of the codebase read the same way.
 */

export const TENANT_PERMISSIONS = {
  /** See the connection and its health. Everyone in the workspace. */
  WHATSAPP_READ: "whatsapp:read",
  /** Paste credentials, run the wizard, disconnect. */
  WHATSAPP_CONNECT: "whatsapp:connect",
  /** Send a test, sync templates, update a token. */
  WHATSAPP_MANAGE: "whatsapp:manage",
} as const;

export type TenantPermission =
  (typeof TENANT_PERMISSIONS)[keyof typeof TENANT_PERMISSIONS];

/**
 * Role to permissions, as a total record.
 *
 * Total on purpose: adding a role to `TenantUserRole` without deciding what it
 * may do is a compile error here, rather than a role that silently holds
 * nothing — or, worse, one that a `?? DEFAULT` quietly grants everything to.
 *
 * Connecting a number is an OWNER and ADMIN act. It spends the plan's number
 * allowance, it stores a credential that can message the shop's customers, and
 * it is not something an agent answering chats should be able to change.
 */
const ROLE_PERMISSIONS: Readonly<
  Record<TenantUserRole, readonly TenantPermission[]>
> = {
  OWNER: [
    TENANT_PERMISSIONS.WHATSAPP_READ,
    TENANT_PERMISSIONS.WHATSAPP_CONNECT,
    TENANT_PERMISSIONS.WHATSAPP_MANAGE,
  ],
  ADMIN: [
    TENANT_PERMISSIONS.WHATSAPP_READ,
    TENANT_PERMISSIONS.WHATSAPP_CONNECT,
    TENANT_PERMISSIONS.WHATSAPP_MANAGE,
  ],
  AGENT: [TENANT_PERMISSIONS.WHATSAPP_READ],
  VIEWER: [TENANT_PERMISSIONS.WHATSAPP_READ],
};

export function permissionsForRole(
  role: TenantUserRole,
): readonly TenantPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(
  role: TenantUserRole,
  permission: TenantPermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * The fallback when a workspace session has no matching row in the master
 * `tenant_users` table.
 *
 * VIEWER rather than null: the two databases can disagree — a user created in
 * the tenant database whose master row was removed, or an environment where
 * only one of the two was seeded. Read access with no power to change anything
 * is the safe reading of "we are not sure who this is", and it keeps a
 * half-provisioned workspace usable instead of locking its staff out.
 */
export const FALLBACK_TENANT_ROLE: TenantUserRole = "VIEWER";
