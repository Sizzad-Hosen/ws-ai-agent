import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  Gauge,
  Handshake,
  ShoppingCart,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";
import {
  PsButton,
  PsCard,
  PsIconTile,
  PsSection,
  PsSectionHeading,
} from "@/features/public-site/components/ui";
import {
  LANDING_CONVERSATION,
  WhatsappMockup,
} from "@/features/public-site/components/whatsapp-mockup";

export const metadata: Metadata = {
  title: "Turn WhatsApp conversations into sales",
  description:
    "Deploy a conversational AI agent that qualifies leads, answers product questions, and collects orders directly within WhatsApp, 24/7.",
};

const BENEFITS = [
  {
    icon: Clock,
    title: "24/7 Instant Replies",
    body: "Never miss a lead. Engage prospects immediately, day or night, reducing bounce rates and capturing intent when it's highest.",
  },
  {
    icon: Gauge,
    title: "Faster Customer Response",
    body: "Reduce average response time from hours to seconds. Answer FAQs and qualify leads without human intervention.",
  },
  {
    icon: ShoppingCart,
    title: "Automated Order Collection",
    body: "Seamlessly process orders, capture payment intent, and update CRM records directly from the WhatsApp chat thread.",
  },
  {
    icon: Handshake,
    title: "Human Handoff",
    body: "Smart routing detects complex queries or high-value accounts and seamlessly transfers the conversation to a human rep.",
  },
] as const;

export default function PublicHomePage() {
  return (
    <>
      <section className="section-ps">
        <div className="container-ps grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <h1 className="text-ps-ink font-display text-display-md lg:text-display-lg text-balance">
              Turn WhatsApp Conversations Into Sales&nbsp;—{" "}
              <span className="text-ps-brand-deep">Automatically</span>
            </h1>

            <p className="text-ps-ink-muted text-lead mt-6 text-pretty">
              Deploy a conversational AI agent that qualifies leads, answers
              product questions, and collects orders directly within WhatsApp,
              24/7. Close deals faster with zero manual effort.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PsButton asChild size="lg">
                <Link href={ROUTES.public.register}>
                  Start Free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </PsButton>
              <PsButton asChild variant="secondary" size="lg">
                <Link href={ROUTES.public.demo}>Watch Demo</Link>
              </PsButton>
            </div>

            <p className="text-ps-ink-muted mt-6 flex items-center gap-2 text-sm">
              <CircleCheck
                className="text-ps-brand size-4 shrink-0"
                aria-hidden="true"
              />
              No credit card required.
            </p>
          </div>

          <WhatsappMockup
            bubbles={LANDING_CONVERSATION}
            typing
            className="lg:max-w-md lg:justify-self-end"
          />
        </div>
      </section>

      <PsSection tone="panel">
        <PsSectionHeading
          title="Why Top Sales Teams Choose SellPilot"
          description="Automate the busywork and focus on closing high-value deals with enterprise-grade reliability."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <PsCard key={benefit.title} interactive className="flex flex-col">
              <PsIconTile tone="brand">
                <benefit.icon className="size-5" />
              </PsIconTile>
              <h3 className="text-ps-ink font-display mt-5 text-lg font-semibold">
                {benefit.title}
              </h3>
              <p className="text-ps-ink-muted mt-3 text-sm leading-relaxed">
                {benefit.body}
              </p>
            </PsCard>
          ))}
        </div>
      </PsSection>
    </>
  );
}
