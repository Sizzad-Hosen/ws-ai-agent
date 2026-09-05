import type { Metadata } from "next";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { ReasoningDemo } from "@/features/public-site/components/reasoning-demo";
import { PsButton } from "@/features/public-site/components/ui";

export const metadata: Metadata = {
  title: "Live intent & automation demo",
  description:
    "Watch SellPilot AI interpret natural language on WhatsApp, check backend inventory in real time, and orchestrate the checkout flow.",
};

export default function DemoPage() {
  return (
    <section className="section-ps">
      <div className="container-ps">
        <div className="max-w-3xl">
          <h1 className="text-ps-ink font-display text-display-md lg:text-display-lg text-balance">
            Live Intent &amp; Automation Demo
          </h1>
          <p className="text-ps-ink-muted text-lead mt-6 text-pretty">
            Watch as SellPilot AI interprets natural language on WhatsApp,
            checks backend inventory in real-time, and orchestrates the entire
            checkout flow autonomously.
          </p>
        </div>

        <div className="mt-12">
          <ReasoningDemo />
        </div>

        <p className="text-ps-ink-subtle mt-6 max-w-3xl text-sm">
          This walkthrough replays a recorded conversation so the reasoning
          stages stay legible. Connect your own catalogue to watch the agent run
          against live inventory.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <PsButton asChild>
            <Link href={ROUTES.public.register}>Start Free</Link>
          </PsButton>
          <PsButton asChild variant="secondary">
            <Link href={ROUTES.public.pricing}>See pricing</Link>
          </PsButton>
        </div>
      </div>
    </section>
  );
}
