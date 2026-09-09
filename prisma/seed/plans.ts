/**
 * The subscription catalogue.
 *
 * Limits live in the `max_*` columns. Marketing copy lives in `features`,
 * whose versioned contract is `PlanFeatures` in src/features/plans/types.ts.
 *
 * Upserts key on `code`, so running the seed twice converges. `update` carries
 * the same fields as `create`: a plan edited by hand in the database should be
 * put back, or the seed would not be a known starting point.
 */
import type { Plan } from "@prisma/client";

import { prisma } from "./client";

const PLANS = [
  {
    code: "starter",
    name: "Starter",
    description: "For small teams testing WhatsApp automation.",
    monthlyPrice: "2900.00",
    annualPrice: "27840.00",
    maxWhatsappNumbers: 1,
    maxAiMessages: 2_000,
    maxProducts: 100,
    sortOrder: 1,
    features: {
      version: 1,
      toggles: [
        { key: "knowledge_base", label: "Knowledge Base", enabled: true },
        { key: "analytics", label: "Analytics", enabled: false },
        { key: "human_handoff", label: "Human Handoff", enabled: false },
      ],
      highlights: ["1 WhatsApp number", "2,000 AI messages", "Email support"],
      accentColor: "#e2e8f0",
    },
  },
  {
    code: "business",
    name: "Business",
    description: "For growing businesses automating WhatsApp sales.",
    monthlyPrice: "8900.00",
    annualPrice: "85440.00",
    maxWhatsappNumbers: 3,
    maxAiMessages: 20_000,
    maxProducts: 2_000,
    sortOrder: 2,
    features: {
      version: 1,
      toggles: [
        { key: "knowledge_base", label: "Knowledge Base", enabled: true },
        { key: "analytics", label: "Analytics", enabled: true },
        { key: "human_handoff", label: "Human Handoff", enabled: true },
      ],
      highlights: [
        "3 WhatsApp numbers",
        "20,000 AI messages",
        "Analytics",
        "Human handoff",
      ],
      accentColor: "#d1fae5",
      popular: true,
    },
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description:
      "For large organisations needing dedicated support and custom models.",
    // Null prices render as "Custom" on the pricing cards.
    monthlyPrice: null,
    annualPrice: null,
    // Zero means unlimited on this tier. The CHECK constraints forbid a
    // negative, and a null would make every limit comparison a special case.
    maxWhatsappNumbers: 0,
    maxAiMessages: 0,
    maxProducts: 0,
    sortOrder: 3,
    features: {
      version: 1,
      toggles: [
        { key: "knowledge_base", label: "Knowledge Base", enabled: true },
        { key: "analytics_advanced", label: "Analytics (Advanced)", enabled: true },
        { key: "white_label_handoff", label: "White-label Handoff", enabled: true },
      ],
      highlights: [
        "Unlimited WhatsApp numbers",
        "Unlimited AI messages",
        "Dedicated account manager",
        "24/7 priority support",
      ],
      accentColor: "#dbeafe",
    },
  },
] as const;

export async function seedPlans(): Promise<Record<string, Plan>> {
  const byCode: Record<string, Plan> = {};

  for (const plan of PLANS) {
    const fields = {
      name: plan.name,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice,
      currency: "BDT",
      maxWhatsappNumbers: plan.maxWhatsappNumbers,
      maxAiMessages: plan.maxAiMessages,
      maxProducts: plan.maxProducts,
      features: plan.features,
      sortOrder: plan.sortOrder,
      isActive: true,
    };

    byCode[plan.code] = await prisma.plan.upsert({
      where: { code: plan.code },
      update: fields,
      create: { code: plan.code, ...fields },
    });
  }

  return byCode;
}
