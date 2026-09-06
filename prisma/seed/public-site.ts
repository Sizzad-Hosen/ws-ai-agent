/** Public marketing site: pages, FAQs and site settings. */

import { PublicPageStatus } from "@prisma/client";
import { prisma } from "./client";
import { daysAgo } from "./helpers";

export async function seedPublicSite(): Promise<void> {
  const pages = [
    {
      slug: "home",
      title: "Sell on WhatsApp while you sleep",
      content:
        "Ordivex answers every lead on WhatsApp, qualifies them, and closes orders automatically.",
    },
    {
      slug: "how-it-works",
      title: "How it works",
      content:
        "Connect your WhatsApp Business number, train the agent on your catalogue, and let it handle conversations end to end.",
    },
    {
      slug: "demo",
      title: "See the automation flow",
      content:
        "A guided walkthrough of a real conversation from first message to confirmed order.",
    },
    {
      slug: "categories",
      title: "Built for your category",
      content:
        "Retail, grocery, electronics, beauty and professional services, with playbooks for each.",
    },
    {
      slug: "pricing",
      title: "Pricing and use cases",
      content:
        "Starter, Business and Enterprise tiers sized by AI message volume, WhatsApp numbers and team seats.",
    },
    {
      slug: "about",
      title: "About us",
      content:
        "We build reliable AI sales infrastructure for businesses that live in WhatsApp.",
    },
  ] as const;

  for (const page of pages) {
    await prisma.publicPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content,
        status: PublicPageStatus.PUBLISHED,
        publishedAt: daysAgo(30),
        seoMetadata: {
          title: `${page.title} | Ordivex`,
          description: page.content.slice(0, 155),
        },
      },
    });
  }

  const faqs = [
    {
      question: "Do I need a WhatsApp Business API account?",
      answer:
        "Yes. We guide you through Meta business verification during onboarding and connect the number for you.",
    },
    {
      question: "How long does setup take?",
      answer:
        "Most businesses are live within a day once Meta approves the number.",
    },
    {
      question: "Can a human take over a conversation?",
      answer:
        "Yes. Human handoff is available on Business and Enterprise plans, and the agent hands over with full context.",
    },
    {
      question: "What happens if I exceed my AI message limit?",
      answer:
        "You are warned as you approach the limit and can upgrade at any time; conversations are never dropped silently.",
    },
    {
      question: "Where is my data stored?",
      answer:
        "Each business gets a dedicated database in the region you choose at signup.",
    },
  ] as const;

  for (const [index, faq] of faqs.entries()) {
    const existing = await prisma.publicFaq.findFirst({
      where: { question: faq.question },
    });

    if (!existing) {
      await prisma.publicFaq.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          sortOrder: index + 1,
          isActive: true,
        },
      });
    }
  }

  const settings = [
    { siteKey: "brand", value: { name: "Ordivex", primary: "#10B981" } },
    {
      siteKey: "contact",
      value: {
        supportEmail: "support@ordivex.ai",
        salesEmail: "sales@ordivex.ai",
      },
    },
    {
      siteKey: "announcement",
      value: { enabled: false, message: "" },
    },
  ] as const;

  for (const setting of settings) {
    await prisma.publicSiteSetting.upsert({
      where: { siteKey: setting.siteKey },
      update: {},
      create: { siteKey: setting.siteKey, value: setting.value },
    });
  }
}
