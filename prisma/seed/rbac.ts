/**
 * Platform roles and permissions.
 *
 * The permission list mirrors src/constants/permissions.ts; the two must be
 * kept in step, since a code that exists in one and not the other silently
 * grants or denies nothing.
 */

import { prisma } from "./client";

/** Mirrors src/constants/permissions.ts. */
const PERMISSION_CODES = [
  ["dashboard:read", "View the platform overview"],
  ["tenants:read", "View tenants and registrations"],
  ["tenants:manage", "Approve, suspend and edit tenants"],
  ["plans:read", "View the plan catalogue"],
  ["plans:manage", "Create and edit plans"],
  ["subscriptions:read", "View subscriptions"],
  ["subscriptions:manage", "Change and cancel subscriptions"],
  ["ai_settings:read", "View AI provider configuration"],
  ["ai_settings:manage", "Change AI provider configuration"],
  ["usage:read", "View AI usage and cost reporting"],
  ["whatsapp:read", "View WhatsApp account health"],
  ["whatsapp:manage", "Reconnect WhatsApp accounts"],
  ["messages:read", "View the message log"],
  ["billing:read", "View invoices and revenue"],
  ["settings:manage", "Change platform settings"],
  ["audit_logs:read", "Read the audit trail"],
] as const;

/** Mirrors ROLE_PERMISSIONS in src/features/auth/permissions.ts. */
const ROLE_DEFINITIONS: readonly {
  name: string;
  description: string;
  permissions: readonly string[];
}[] = [
  {
    name: "SUPER_ADMIN",
    description: "Unrestricted access to every back-office capability.",
    permissions: PERMISSION_CODES.map(([code]) => code),
  },
  {
    name: "ADMIN",
    description: "Full operational access without revenue reporting.",
    permissions: PERMISSION_CODES.map(([code]) => code).filter(
      (code) => code !== "billing:read",
    ),
  },
  {
    name: "SUPPORT",
    description: "Read-only access for customer support.",
    permissions: [
      "dashboard:read",
      "tenants:read",
      "plans:read",
      "subscriptions:read",
      "whatsapp:read",
      "messages:read",
      "audit_logs:read",
    ],
  },
  {
    name: "FINANCE",
    description: "Revenue, subscription and usage reporting.",
    permissions: [
      "dashboard:read",
      "tenants:read",
      "plans:read",
      "subscriptions:read",
      "subscriptions:manage",
      "usage:read",
      "billing:read",
    ],
  },
];

export async function seedRbac(): Promise<void> {
  for (const [code, description] of PERMISSION_CODES) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.adminRoleRecord.upsert({
      where: { name: definition.name },
      update: { description: definition.description },
      create: { name: definition.name, description: definition.description },
    });

    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...definition.permissions] } },
    });

    // Replace the grant set so removing a permission from the definition
    // actually revokes it.
    await prisma.adminRolePermission.deleteMany({
      where: { roleId: role.id },
    });
    await prisma.adminRolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
}
