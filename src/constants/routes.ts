export const ROUTES = {
  home: "/",
  auth: {
    login: "/bo/login",
  },
  bo: {
    root: "/bo",
    dashboard: "/bo/dashboard",
    tenants: "/bo/tenants",
    tenant: (id: string) => `/bo/tenants/${id}`,
    registrations: "/bo/registrations",
    registration: (id: string) => `/bo/registrations/${id}`,
    plans: "/bo/plans",
    planCreate: "/bo/plans/new",
    planEdit: (id: string) => `/bo/plans/${id}/edit`,
    subscriptions: "/bo/subscriptions",
    aiSettings: "/bo/ai-settings",
    usage: "/bo/usage",
    whatsapp: "/bo/whatsapp",
    messages: "/bo/messages",
    billing: "/bo/billing",
    system: "/bo/system",
    auditLogs: "/bo/audit-logs",
  },
  api: {
    health: "/api/health",
  },
} as const;
