import { ChevronDown } from "lucide-react";

import type { PublicFaq } from "@/features/public-site/faq";

interface FaqListProps {
  readonly faqs: readonly PublicFaq[];
}

/**
 * Native `<details>` rather than a scripted accordion.
 *
 * The rows are static content, so disclosure needs no state.
 * That keeps this a server component, and keeps every answer reachable by
 * in-page search, print and crawlers when JavaScript has not loaded.
 */
export function FaqList({ faqs }: FaqListProps) {
  return (
    <ul className="mx-auto max-w-3xl space-y-4">
      {faqs.map((faq) => (
        <li key={faq.id}>
          <details className="group bg-ps-panel border-ps-edge rounded-card hover:border-ps-brand/30 border transition-[border-color]">
            <summary className="text-ps-ink font-display flex cursor-pointer list-none items-center justify-between gap-6 p-6 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-8 [&::-webkit-details-marker]:hidden">
              {faq.question}
              <ChevronDown
                className="text-ps-brand size-5 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="text-ps-ink-muted px-6 pb-6 leading-relaxed sm:px-8 sm:pb-8">
              {faq.answer}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}
