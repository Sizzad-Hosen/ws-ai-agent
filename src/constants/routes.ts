export const ROUTES = {
  home: "/",
  auth: {
    login: "/bo/login",
  },
  bo: {
    root: "/bo",
    dashboard: "/bo/dashboard",
    tenants: "/bo/tenants",
    plans: "/bo/plans",
    subscriptions: "/bo/subscriptions",
    aiSettings: "/bo/ai-settings",
    whatsapp: "/bo/whatsapp",
    usage: "/bo/usage",
    billing: "/bo/billing",
    system: "/bo/system",
    auditLogs: "/bo/audit-logs",
  },
  api: {
    health: "/api/health",
  },
} as const;
