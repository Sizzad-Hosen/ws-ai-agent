import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Eye, Lightbulb, Users } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import {
  PsButton,
  PsCard,
  PsSection,
  PsSectionHeading,
} from "@/features/public-site/components/ui";

export const metadata: Metadata = {
  title: "About us",
  description:
    "We build intelligent systems that handle the heavy lifting, so sales teams can focus on building meaningful relationships.",
};

const VALUES = [
  {
    icon: Lightbulb,
    title: "Innovation",
    body: "We continuously push the boundaries of AI to solve complex sales challenges elegantly.",
  },
  {
    icon: BadgeCheck,
    title: "Reliability",
    body: "Enterprise-grade stability and security are the foundation of everything we build.",
  },
  {
    icon: Users,
    title: "Customer-Centricity",
    body: "Your growth is our success. We design our tools to adapt to your specific workflow.",
  },
  {
    icon: Eye,
    title: "Transparency",
    body: "Clear communication and accountable AI models ensure trust at every step.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      {/*
        The mockup places a photograph behind this hero. No licensed asset ships
        with the repo, so a brand gradient stands in rather than a hot-linked or
        placeholder image — swap in a real photograph when one is cleared.
      */}
      <section className="from-ps-brand-wash via-ps-page to-ps-page bg-gradient-to-br">
        <div className="container-ps py-24 text-center md:py-32">
          <h1 className="text-ps-ink font-display text-display-md lg:text-display-lg text-balance">
            Humanizing Sales Through AI
          </h1>
          <p className="text-ps-ink-muted text-lead mx-auto mt-6 max-w-2xl text-pretty">
            We build intelligent systems that handle the heavy lifting,
            empowering your sales teams to focus on what truly matters: building
            meaningful relationships.
          </p>
        </div>
      </section>

      <PsSection tone="panel">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-ps-ink font-display text-title-lg text-balance">
              Our Story
            </h2>
            <p className="text-ps-ink-muted mt-6 leading-relaxed">
              Ordivex was born from a simple observation: sales professionals
              spend too much time on repetitive tasks and not enough time
              selling. We saw talented individuals bogged down by data entry,
              follow-up sequencing, and pipeline management.
            </p>
            <p className="text-ps-ink-muted mt-4 leading-relaxed">
              Our founders, veterans of both high-growth sales teams and
              advanced machine learning labs, set out to create a solution. By
              automating the operational friction, Ordivex restores the human
              element to sales, allowing teams to operate with unprecedented
              efficiency and composed confidence.
            </p>
          </div>

          <div
            className="bg-ps-panel-soft border-ps-edge rounded-card aspect-[4/3] border"
            role="img"
            aria-label="Placeholder for a photograph of the Ordivex team"
          />
        </div>
      </PsSection>

      <PsSection>
        <PsSectionHeading
          title="Core Values"
          description="The principles that guide our product development and our team culture."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <PsCard key={value.title} className="h-full">
              <value.icon className="text-ps-brand size-6" aria-hidden="true" />
              <h3 className="text-ps-ink font-display text-eyebrow mt-5 uppercase">
                {value.title}
              </h3>
              <p className="text-ps-ink-muted mt-3 text-sm leading-relaxed">
                {value.body}
              </p>
            </PsCard>
          ))}
        </div>
      </PsSection>

      <PsSection tone="panel">
        <div
          id="careers"
          className="bg-ps-brand-wash border-ps-brand/20 rounded-card scroll-mt-24 border px-6 py-14 text-center sm:px-12"
        >
          <h2 className="text-ps-ink font-display text-title-lg text-balance">
            Help Us Shape the Future of Sales
          </h2>
          <p className="text-ps-ink-muted mx-auto mt-4 max-w-xl text-pretty">
            We&apos;re always looking for brilliant minds who are passionate
            about AI and user experience. Join our growing team.
          </p>
          <PsButton asChild className="mt-8">
            <Link href={ROUTES.public.register}>View Open Positions</Link>
          </PsButton>
        </div>
      </PsSection>
    </>
  );
}
