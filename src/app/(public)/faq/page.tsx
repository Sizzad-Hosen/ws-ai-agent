import type { Metadata } from "next";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { FaqList } from "@/features/public-site/components/faq-list";
import { PsButton, PsSection } from "@/features/public-site/components/ui";
import { repositories } from "@/server/repositories";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers on WhatsApp Business API access, setup time, human handoff, message limits and where your data is stored.",
};

export default async function FaqPage() {
  // Read from `public_faqs` rather than a constant in this file, so an answer
  // is editable content — the treatment the pricing page gives the catalogue.
  const faqs = await repositories.faqs.findPublished();

  return (
    <>
      <PsSection>
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-ps-ink font-display text-display-md lg:text-display-lg text-balance">
            Frequently Asked Questions
          </h1>
          <p className="text-ps-ink-muted text-lead mt-6 text-pretty">
            What teams ask before they connect their first WhatsApp number.
            Anything we have not covered, our team will answer directly.
          </p>
        </div>

        <div className="mt-14">
          {faqs.length === 0 ? (
            <p className="text-ps-ink-muted border-ps-edge rounded-card mx-auto max-w-3xl border border-dashed px-6 py-16 text-center">
              Our answers are being updated. Please check back shortly.
            </p>
          ) : (
            <FaqList faqs={faqs} />
          )}
        </div>
      </PsSection>

      <PsSection tone="panel">
        <div className="bg-ps-brand-wash border-ps-brand/20 rounded-card border px-6 py-14 text-center sm:px-12">
          <h2 className="text-ps-ink font-display text-title-lg text-balance">
            Still have a question?
          </h2>
          <p className="text-ps-ink-muted mx-auto mt-4 max-w-xl text-pretty">
            Walk through the agent on a live conversation, or start free and ask
            us as you go.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PsButton asChild>
              <Link href={ROUTES.public.demo}>See the live demo</Link>
            </PsButton>
            <PsButton asChild variant="secondary">
              <Link href={ROUTES.public.register}>Start Free</Link>
            </PsButton>
          </div>
        </div>
      </PsSection>
    </>
  );
}
