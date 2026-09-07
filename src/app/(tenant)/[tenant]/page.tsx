import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MessageCircle, Store, Wrench } from "lucide-react";
import { cache, type ReactNode } from "react";

import { APP_CONFIG } from "@/config/app";
import { isReservedTenantSlug } from "@/constants/reserved-slugs";
import { ROUTES } from "@/constants/routes";
import { listStorefrontVariants } from "@/features/storefront-assistant/catalogue";
import { StorefrontChat } from "@/features/storefront-assistant/components/storefront-chat";
import {
  loadAssistantSettings,
  type AssistantSettings,
} from "@/features/storefront-assistant/settings";
import type { StorefrontVariant } from "@/features/storefront-assistant/catalogue";
import { repositories } from "@/server/repositories";
import type { TenantSite } from "@/server/repositories/contracts/tenant-repository";
import { resolveTenant } from "@/server/tenancy/resolve-tenant";
import { formatMoney } from "@/utils/format";

/** Digits only, as wa.me expects. */
function whatsappLink(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, "")}`;
}

/**
 * A tenant's public storefront.
 *
 * Served from the application root, so `/clickeibazar` is that tenant's site.
 * Static routes win over this dynamic segment in Next.js, which is why
 * provisioning refuses to hand a tenant a reserved slug: a tenant holding
 * "pricing" would not shadow the marketing page, it would simply never resolve.
 *
 * Everything rendered is a column that exists. There is no catalogue model on
 * the master side, so this page does not invent products — it shows the
 * business, the number its agent answers on, and the honest state of the
 * workspace behind it.
 */
export default async function TenantSitePage({
  params,
}: PageProps<"/[tenant]">) {
  const site = await resolve(params);

  // A workspace that is not live has no storefront. Suspended says so; anything
  // else is indistinguishable from a URL that was never a tenant.
  if (site.approvalStatus === "suspended") {
    return <Unavailable site={site} />;
  }

  if (site.approvalStatus !== "active" && site.approvalStatus !== "trial") {
    notFound();
  }

  const live = site.databaseStatus === "ready";
  const chat = whatsappLink(site.whatsappNumber);
  // Everything below this line comes from the tenant's own database, through
  // the same resolver the dashboard uses. A storefront can therefore only ever
  // show its own shop's catalogue — there is no query here that could reach
  // another tenant's rows.
  const shop = live ? await loadShopfront(site.slug) : null;

  return (
    <>
      <header className="border-ps-edge bg-ps-panel border-b">
        <div className="container-ps flex h-16 items-center justify-between gap-4">
          <span className="text-ps-ink font-display truncate text-xl font-semibold tracking-tight">
            {site.businessName}
          </span>
          <a
            href={chat}
            className="bg-ps-brand-deep rounded-control inline-flex h-10 shrink-0 items-center gap-2 px-4 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Chat on WhatsApp
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="container-ps py-16 sm:py-24">
          <p className="text-ps-brand-deep text-eyebrow uppercase">
            {site.industry ?? "Independent business"}
          </p>
          <h1 className="text-ps-ink font-display mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {site.businessName}
          </h1>
          <p className="text-ps-ink-muted mt-5 max-w-xl text-lg">
            Ask about anything in stock, get a price, and order — right here or
            on WhatsApp. The assistant answers in seconds, day or night.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={chat}
              className="bg-ps-ink rounded-control inline-flex h-12 items-center gap-2 px-6 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Start a chat
            </a>
            <span className="text-ps-ink-subtle tabular text-sm">
              {site.whatsappNumber}
            </span>
          </div>

          {live ? null : (
            <p
              className="border-ps-edge bg-ps-panel text-ps-ink-muted mt-10 flex max-w-xl items-start gap-3 rounded-2xl border p-5 text-sm"
              role="status"
            >
              <Wrench
                className="text-ps-ink-subtle mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                This storefront is still being set up. The WhatsApp number above
                is live; the catalogue arrives once provisioning finishes.
              </span>
            </p>
          )}
        </section>

        {shop && shop.variants.length > 0 ? (
          <section className="container-ps pb-16">
            <h2 className="text-ps-ink font-display text-2xl font-semibold tracking-tight">
              In stock now
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shop.variants.map((variant) => (
                <li
                  key={variant.variantId}
                  className="border-ps-edge bg-ps-panel rounded-2xl border p-5"
                >
                  <p className="text-ps-ink font-medium">
                    {variant.productName}
                  </p>
                  <p className="text-ps-ink-subtle mt-1 text-xs">
                    {variant.categoryName ?? variant.sku}
                  </p>
                  <p className="text-ps-ink mt-4 text-lg font-semibold">
                    {formatMoney(variant.price, shop.settings.currency) ??
                      variant.price}
                  </p>
                  <p className="text-ps-ink-subtle mt-1 text-xs">
                    {variant.available > 0
                      ? `${variant.available} available`
                      : "Out of stock"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-ps-edge bg-ps-panel border-y">
          <div className="container-ps grid gap-8 py-12 sm:grid-cols-3">
            <Fact
              icon={<Store className="size-4" aria-hidden="true" />}
              label="Business"
              value={site.businessName}
            />
            <Fact
              icon={<Globe className="size-4" aria-hidden="true" />}
              label="Serving"
              value={site.region ?? "Worldwide"}
            />
            <Fact
              icon={<MessageCircle className="size-4" aria-hidden="true" />}
              label="Orders via"
              value="WhatsApp"
            />
          </div>
        </section>
      </main>

      <SiteFooter businessName={site.businessName} />

      {shop?.settings.enabled ? (
        <StorefrontChat
          slug={site.slug}
          businessName={site.businessName}
          greeting={greetingFor(site.businessName, shop.settings)}
          openingQuestions={[
            "What do you sell?",
            "Delivery charge?",
            "কী কী আছে?",
          ]}
        />
      ) : null}
    </>
  );
}

/**
 * The tenant's own catalogue and assistant settings.
 *
 * Failures are swallowed into `null`: a database that is provisioned but
 * momentarily unreachable should cost the shop its chat widget for one
 * request, not its whole page.
 */
async function loadShopfront(slug: string): Promise<{
  readonly settings: AssistantSettings;
  readonly variants: readonly StorefrontVariant[];
} | null> {
  try {
    const resolution = await resolveTenant(slug);

    if (!resolution.ok) return null;

    const [settings, variants] = await Promise.all([
      loadAssistantSettings(resolution.tenant.db),
      listStorefrontVariants(resolution.tenant.db, 4),
    ]);

    return { settings, variants };
  } catch (error: unknown) {
    console.error(`Could not load the storefront for ${slug}.`, error);
    return null;
  }
}

function greetingFor(
  businessName: string,
  settings: AssistantSettings,
): string {
  return settings.greeting.trim() !== ""
    ? settings.greeting
    : `Welcome to ${businessName}. Ask me about products, prices or stock — I can take your order right here.`;
}

export async function generateMetadata({
  params,
}: PageProps<"/[tenant]">): Promise<Metadata> {
  // Shares the page's cached lookup, so an unknown slug takes the same
  // not-found path here rather than emitting a title for a page that 404s.
  //
  // The response still carries HTTP 200: this route streams, and Next.js
  // documents that a streamed response cannot change status once it has begun
  // (`not-found.js` → Status codes). It injects `<meta name="robots"
  // content="noindex">` for exactly this case, which is what keeps a soft 404
  // out of search results. A real 404 status would mean resolving the tenant in
  // `proxy` before the response starts — a database round trip on every request
  // to the whole application, to change a status code that no user sees.
  const site = await resolve(params);

  return {
    title: site.businessName,
    description: `Order from ${site.businessName} on WhatsApp.`,
    // A storefront that is not live yet should not be indexed as one.
    robots: site.databaseStatus === "ready" ? undefined : { index: false },
  };
}

/**
 * Resolves the slug, or 404s.
 *
 * Cached so metadata and the page share one query per request rather than
 * hitting the database twice for the same row.
 */
const lookup = cache(async (slug: string): Promise<TenantSite | null> => {
  // Reserved slugs are never tenants. Checked here as well as at provisioning
  // so a row predating the reserved list cannot claim a platform path.
  if (isReservedTenantSlug(slug)) return null;

  return repositories.tenants.findSiteBySubdomain(slug);
});

async function resolve(
  params: PageProps<"/[tenant]">["params"],
): Promise<TenantSite> {
  const { tenant } = await params;
  const site = await lookup(tenant.toLowerCase());

  if (!site) notFound();

  return site;
}

function Unavailable({ site }: { readonly site: TenantSite }) {
  return (
    <main className="container-ps flex flex-1 items-center py-24">
      <div className="max-w-xl">
        <h1 className="text-ps-ink font-display text-3xl font-semibold tracking-tight">
          {site.businessName} is not taking orders right now
        </h1>
        <p className="text-ps-ink-muted mt-4">
          This storefront has been suspended. If you are the owner, contact
          support to restore it.
        </p>
        <Link
          href={ROUTES.public.home}
          className="text-ps-brand-deep mt-6 inline-block text-sm font-medium hover:underline"
        >
          About {APP_CONFIG.name}
        </Link>
      </div>
    </main>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <p className="text-ps-ink-subtle flex items-center gap-2 text-xs uppercase">
        {icon}
        {label}
      </p>
      <p className="text-ps-ink mt-2 font-medium">{value}</p>
    </div>
  );
}

function SiteFooter({ businessName }: { readonly businessName: string }) {
  return (
    <footer className="border-ps-edge border-t">
      <div className="container-ps text-ps-ink-subtle flex flex-wrap items-center justify-between gap-3 py-8 text-sm">
        <span>
          © {new Date().getFullYear()} {businessName}
        </span>
        <Link href={ROUTES.public.home} className="hover:text-ps-ink">
          Powered by {APP_CONFIG.name}
        </Link>
      </div>
    </footer>
  );
}
