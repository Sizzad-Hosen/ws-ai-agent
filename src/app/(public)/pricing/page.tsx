import type { Metadata } from "next";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { PricingTable } from "@/features/public-site/components/pricing-table";
import { PsButton, PsSection } from "@/features/public-site/components/ui";
import {
  annualSavingPercent,
  toPublicPlans,
} from "@/features/public-site/pricing";
import { repositories } from "@/server/repositories";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Plans for teams starting with AI sales through to high-volume operations. No credit card required to start.",
};

export default async function PricingPage() {
  // The catalogue is the same one the back office edits, so a price change
  // reaches this page without a deploy.
  const plans = toPublicPlans(await repositories.plans.findAll());

  return (
    <>
      <PsSection>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-ps-ink font-display text-display-md lg:text-display-lg text-balance">
            Pricing that scales with your pipeline
          </h1>
          <p className="text-ps-ink-muted text-lead mt-6 text-pretty">
            Start free, then pick the tier that matches your conversation
            volume. Every plan includes the full conversational agent.
          </p>
        </div>

        <div className="mt-14">
          {plans.length === 0 ? (
            <p className="text-ps-ink-muted border-ps-edge rounded-card border border-dashed px-6 py-16 text-center">
              Pricing is being updated. Please check back shortly.
            </p>
          ) : (
            <PricingTable
              plans={plans}
              savingPercent={annualSavingPercent(plans)}
            />
          )}
        </div>
      </PsSection>

      <PsSection tone="panel">
        <div className="bg-ps-ink rounded-card px-6 py-16 text-center sm:px-12">
          <h2 className="font-display text-title-lg text-balance text-white">
            Ready to automate your revenue?
          </h2>
          <p className="text-copy mx-auto mt-4 max-w-2xl text-pretty text-white/70">
            Join thousands of high-growth companies using Ordivex to convert
            leads 24/7 without adding headcount.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PsButton asChild variant="onDark" size="lg">
              <Link href={ROUTES.public.register}>Start Free Trial</Link>
            </PsButton>
            <PsButton
              asChild
              size="lg"
              className="border border-white/25 bg-transparent text-white hover:bg-white/10"
            >
              <Link href={ROUTES.public.demo}>Book a Demo</Link>
            </PsButton>
          </div>
        </div>
      </PsSection>
    </>
  );
}
