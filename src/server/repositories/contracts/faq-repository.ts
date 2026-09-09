import type { PublicFaq } from "@/features/public-site/faq";

export interface FaqRepository {
  /** Active entries only, in `sort_order`; the public site never sees drafts. */
  findPublished(): Promise<readonly PublicFaq[]>;
}
