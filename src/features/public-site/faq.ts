/**
 * A published FAQ entry as the public site needs it.
 *
 * `public_faqs` carries no `tenant_id` — the FAQ belongs to the platform's own
 * marketing site, not to a tenant's storefront.
 */
export interface PublicFaq {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}
