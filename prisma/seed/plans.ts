/** The subscription catalogue (screen 05). */

import { prisma } from "./client";

export async function seedPlans() {
  const starter = await prisma.plan.upsert({
    where: { code: "starter" },
    update: {},
    create: {
      code: "starter",
      name: "Starter",
      description: "For small teams testing WhatsApp automation.",
      monthlyPrice: "99.00",
      annualPrice: "950.00",
      currency: "USD",
      sortOrder: 1,
      isActive: true,
      features: {
        version: 1,
        toggles: [
          { key: "knowledge_base", label: "Knowledge Base", enabled: true },
          { key: "analytics", label: "Analytics", enabled: false },
          { key: "human_handoff", label: "Human Handoff", enabled: false },
        ],
        highlights: ["Knowledge Base", "Email support"],
        accentColor: "#e2e8f0",
      },
    },
  });

  const business = await prisma.plan.upsert({
    where: { code: "business" },
    update: {},
    create: {
      code: "business",
      name: "Business",
      description: "For growing businesses automating WhatsApp sales.",
      monthlyPrice: "299.00",
      annualPrice: "2870.00",
      currency: "USD",
      sortOrder: 2,
      isActive: true,
      features: {
        version: 1,
        toggles: [
          { key: "knowledge_base", label: "Knowledge Base", enabled: true },
          { key: "analytics", label: "Analytics", enabled: true },
          { key: "human_handoff", label: "Human Handoff", enabled: true },
        ],
        highlights: ["Knowledge Base", "Analytics", "Human Handoff"],
        accentColor: "#d1fae5",
        popular: true,
      },
    },
  });

  const enterprise = await prisma.plan.upsert({
    where: { code: "enterprise" },
    update: {},
    create: {
      code: "enterprise",
      name: "Enterprise",
      description:
        "Full-featured tier for large organizations requiring advanced AI capabilities and dedicated support.",
      // Null price renders as "Custom" on the plan cards.
      monthlyPrice: null,
      annualPrice: null,
      currency: "USD",
      sortOrder: 3,
      isActive: true,
      features: {
        version: 1,
        toggles: [
          { key: "knowledge_base", label: "Knowledge Base", enabled: true },
          {
            key: "analytics_advanced",
            label: "Analytics (Advanced)",
            enabled: true,
          },
          {
            key: "white_label_handoff",
            label: "White-label Handoff",
            enabled: true,
          },
        ],
        highlights: [
          "Unlimited AI Configurations",
          "Dedicated Account Manager",
          "24/7 Priority Support",
          "Custom Model Fine-tuning",
          "Advanced Audit Logging",
        ],
        accentColor: "#dbeafe",
      },
    },
  });

  return { starter, business, enterprise };
}
