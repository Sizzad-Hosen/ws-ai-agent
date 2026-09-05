import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  ChartNoAxesCombined,
  Languages,
  Search,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";
import {
  PsCard,
  PsIconTile,
  PsSection,
  PsSectionHeading,
} from "@/features/public-site/components/ui";

export const metadata: Metadata = {
  title: "Intelligent sales workflow",
  description:
    "How SellPilot AI autonomously manages conversations, discovers products, and closes deals with unparalleled precision.",
};

const STEPS = [
  {
    step: "01",
    title: "Connect",
    body: "Integrate with your existing CRM and communication channels seamlessly.",
  },
  {
    step: "02",
    title: "Sync",
    body: "SellPilot instantly ingests your product catalog, pricing, and availability.",
  },
  {
    step: "03",
    title: "AI Starts Selling",
    body: "The AI agent proactively engages leads, answers queries, and recommends products.",
  },
  {
    step: "04",
    title: "Receive Orders",
    body: "Completed transactions are automatically synced back to your dashboard.",
  },
] as const;

const CAPABILITIES = [
  {
    icon: Search,
    title: "Product Discovery",
    body: "Intelligently guides users to the right products based on conversational cues and nuanced requirements, mimicking a seasoned sales rep.",
  },
  {
    icon: ShoppingCart,
    title: "Smart Cart Assembly",
    body: "Dynamically builds quotes and shopping carts in real-time during the conversation, streamlining the checkout process for higher conversion rates.",
  },
  {
    icon: Languages,
    title: "Multilingual Context",
    body: "Conducts complex B2B negotiations in over 50 languages natively, maintaining cultural nuances and technical vocabulary accuracy.",
  },
  {
    icon: TrendingUp,
    title: "Objection Handling",
    body: "Pre-trained on thousands of successful sales interactions to politely and effectively address pricing, feature, and competitor objections.",
  },
  {
    icon: ArrowRightLeft,
    title: "Live Inventory Sync",
    body: "Never sells an out-of-stock item. Real-time API connections ensure the AI always has the latest inventory and pricing data before making an offer.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Sentiment Analysis",
    body: "Reads between the lines to detect buyer urgency and hesitation, adjusting its tone and offering incentives or escalation to a human rep when needed.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <PsSection>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-ps-ink font-display text-display-md lg:text-display-lg text-balance">
            Intelligent Sales Workflow
          </h1>
          <p className="text-ps-ink-muted text-lead mt-6 text-pretty">
            Discover how SellPilot AI autonomously manages conversations,
            discovers products, and closes deals with unparalleled precision.
          </p>
        </div>

        <div className="mt-16">
          <PsSectionHeading title="How It Works" />

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.step}>
                <PsCard className="h-full text-center">
                  <span
                    className="bg-ps-brand font-display mx-auto grid size-10 place-items-center rounded-full text-xs font-semibold text-white"
                    aria-hidden="true"
                  >
                    {step.step}
                  </span>
                  <h3 className="text-ps-ink font-display mt-4 text-base font-semibold">
                    <span className="sr-only">Step {step.step}: </span>
                    {step.title}
                  </h3>
                  <p className="text-ps-ink-muted mt-2 text-sm leading-relaxed">
                    {step.body}
                  </p>
                </PsCard>
              </li>
            ))}
          </ol>
        </div>
      </PsSection>

      <PsSection tone="panel">
        <PsSectionHeading title="AI Sales Capabilities" />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <PsCard
              key={capability.title}
              interactive
              className="flex h-full flex-col"
            >
              <PsIconTile>
                <capability.icon className="size-5" />
              </PsIconTile>
              <h3 className="text-ps-ink font-display mt-5 text-lg font-semibold">
                {capability.title}
              </h3>
              <p className="text-ps-ink-muted mt-3 flex-1 text-sm leading-relaxed">
                {capability.body}
              </p>
              <Link
                href={ROUTES.public.demo}
                className="text-ps-brand hover:text-ps-brand-deep mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Learn More
                <ArrowRight className="size-3.5" aria-hidden="true" />
                <span className="sr-only"> about {capability.title}</span>
              </Link>
            </PsCard>
          ))}
        </div>
      </PsSection>
    </>
  );
}
