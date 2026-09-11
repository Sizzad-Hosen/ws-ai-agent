/**
 * The public FAQ.
 *
 * `public_faqs` left the MVP, so these answers are static content rather than
 * rows. They are marketing copy that changes on the same cadence as the pages
 * around them, which is a deploy — unlike the plan catalogue, which the back
 * office genuinely edits and which therefore stays in the database.
 *
 * The FAQ belongs to the platform's own marketing site, not to a tenant's
 * storefront, so there is no tenant scoping to apply.
 */
export interface PublicFaq {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/** Ordered deliberately: access first, then setup, then the operational asks. */
export const PUBLIC_FAQS: readonly PublicFaq[] = [
  {
    id: "whatsapp-api-access",
    question: "Do I need my own WhatsApp Business API access?",
    answer:
      "No. We apply for the WhatsApp Business API on your behalf as part of onboarding, and your number stays registered to your business. If you already hold API access, we connect to it instead.",
  },
  {
    id: "setup-time",
    question: "How long does setup take?",
    answer:
      "Most teams are answering live conversations within two working days. The wait is WhatsApp's own number approval; everything on our side is configured while that clears.",
  },
  {
    id: "human-handoff",
    question: "Can a person take over a conversation?",
    answer:
      "Yes, at any point. The agent hands over when it detects a complex question, a high-value account, or an explicit request for a human, and your team can also take a conversation at will. The full history carries across.",
  },
  {
    id: "message-limits",
    question: "What happens if I exceed my message limit?",
    answer:
      "Conversations keep working. We notify you as you approach the limit and again when you pass it, then bill the overage on your next invoice. Nothing is cut off mid-conversation.",
  },
  {
    id: "data-location",
    question: "Where is my data stored?",
    answer:
      "Each customer gets a separate database, provisioned in the region chosen at signup. Your conversations and customer records are never mixed with another business's.",
  },
  {
    id: "cancellation",
    question: "Can I cancel at any time?",
    answer:
      "Yes. Cancellation takes effect at the end of the period you have paid for, and you can export your conversations and customer records before it does.",
  },
];

/**
 * The first `limit` entries, for the home page preview.
 *
 * Returns everything when `limit` is omitted, which is what /faq renders.
 */
export function publishedFaqs(limit?: number): readonly PublicFaq[] {
  return limit === undefined ? PUBLIC_FAQS : PUBLIC_FAQS.slice(0, limit);
}
