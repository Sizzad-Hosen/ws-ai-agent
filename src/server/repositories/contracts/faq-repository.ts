import type { PublicFaq } from "@/features/public-site/faq";

export interface FaqRepository {
  /**
   * Active entries only, in `sort_order`; the public site never sees drafts.
   *
   * `limit` serves the home page, which previews the first few and links to
   * the full list rather than reading every row to discard most of them.
   */
  findPublished(limit?: number): Promise<readonly PublicFaq[]>;
}
