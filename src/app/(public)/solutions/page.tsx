import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  HeartPulse,
  Shirt,
  Smartphone,
  Sparkles,
  ShoppingBasket,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";
import {
  PsButton,
  PsCard,
  PsIconTile,
  PsSection,
} from "@/features/public-site/components/ui";

export const metadata: Metadata = {
  title: "Tailored AI for every industry",
  description:
    "How SellPilot AI adapts to your vertical, delivering precision-led autonomous sales experiences that resonate with your customers.",
};

/** `id` doubles as the anchor target used by the footer links. */
const INDUSTRIES = [
  {
    id: "fashion",
    icon: Shirt,
    title: "Fashion & Apparel",
    body: "AI agents that handle style advice and instant checkout for clothing brands, increasing conversion rates.",
  },
  {
    id: "electronics",
    icon: Smartphone,
    title: "Electronics",
    body: "Detailed spec comparisons and technical support for gadget stores, ensuring customers find the right device.",
  },
  {
    id: "cosmetics",
    icon: Sparkles,
    title: "Cosmetics & Beauty",
    body: "Personalized routine builders and shade matching for beauty brands, mimicking a high-end consultation.",
  },
  {
    id: "books",
    icon: BookOpen,
    title: "Books & Media",
    body: "Intelligent recommendation engines for bookstores, guiding readers to their next favorite novel or text.",
  },
  {
    id: "grocery",
    icon: ShoppingBasket,
    title: "Grocery & Retail",
    body: "Automated stock checks and quick reordering for local stores, streamlining the everyday shopping experience.",
  },
  {
    id: "healthcare",
    icon: HeartPulse,
    title: "Healthcare & Pharma",
    body: "Information-based agents for scheduling and product queries, maintaining compliance and trust.",
  },
] as const;

export default function SolutionsPage() {
  return (
    <>
      <PsSection>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-ps-ink font-display text-display-md lg:text-display-lg text-balance">
            Tailored AI for Every Industry
          </h1>
          <p className="text-ps-ink-muted text-lead mt-6 text-pretty">
            Discover how SellPilot AI adapts to your specific vertical,
            delivering precision-led autonomous sales experiences that resonate
            with your customers.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => (
            <PsCard
              key={industry.id}
              interactive
              className="flex h-full flex-col"
            >
              <PsIconTile>
                <industry.icon className="size-5" />
              </PsIconTile>
              {/* The heading is the anchor target the footer links to. */}
              <h2
                id={industry.id}
                className="text-ps-ink font-display mt-5 scroll-mt-24 text-xl font-semibold"
              >
                {industry.title}
              </h2>
              <p className="text-ps-ink-muted mt-3 flex-1 text-sm leading-relaxed">
                {industry.body}
              </p>
              <Link
                href={ROUTES.public.demo}
                className="text-ps-brand-deep hover:text-ps-brand-deep/80 mt-6 inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Learn More
                <ArrowRight className="size-3.5" aria-hidden="true" />
                <span className="sr-only"> about {industry.title}</span>
              </Link>
            </PsCard>
          ))}
        </div>
      </PsSection>

      <PsSection tone="panel">
        <div className="bg-ps-brand-wash border-ps-brand/20 rounded-card border px-6 py-12 text-center sm:px-12">
          <h2 className="text-ps-ink font-display text-title-lg text-balance">
            Don&apos;t see your industry?
          </h2>
          <p className="text-ps-ink-muted text-copy mx-auto mt-4 max-w-xl text-pretty">
            SellPilot AI&apos;s flexible architecture allows it to learn and
            adapt to virtually any complex sales environment.
          </p>
          <PsButton asChild variant="secondary" className="bg-ps-panel mt-8">
            <Link href={ROUTES.public.register}>Talk to Sales Engineering</Link>
          </PsButton>
        </div>
      </PsSection>
    </>
  );
}
