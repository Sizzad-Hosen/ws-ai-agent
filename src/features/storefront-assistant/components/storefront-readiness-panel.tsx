import Link from "next/link";
import { CircleAlert, CircleCheck, PackageX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { StorefrontReadiness } from "@/features/storefront-assistant/catalogue";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { formatNumber } from "@/utils/format";

interface StorefrontReadinessPanelProps {
  readonly slug: string;
  readonly readiness: StorefrontReadiness;
}

/**
 * What the assistant can and cannot show a customer, and why.
 *
 * The storefront offers a *variant* of an *active* product, because that is
 * the only thing an order line can name. Three ordinary situations therefore
 * produce an empty shop — everything still in draft, products with no variant,
 * or an empty catalogue — and from the chat window they are indistinguishable.
 * This says which one it is, in the place the owner configures the assistant.
 */
export function StorefrontReadinessPanel({
  slug,
  readiness,
}: StorefrontReadinessPanelProps) {
  const blocked = blockers(readiness);

  return (
    <Card>
      <CardHeader
        title="What customers can see"
        description="The chat offers a variant of an active product — that is the only thing an order can be placed against."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link href={tenantHref(slug, "products")}>Open products</Link>
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <p className="flex items-center gap-2 text-sm">
          {readiness.sellableVariants > 0 ? (
            <CircleCheck
              className="size-4 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
          ) : (
            <CircleAlert
              className="text-destructive size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>
            <strong>{formatNumber(readiness.sellableVariants)}</strong>{" "}
            {readiness.sellableVariants === 1 ? "item" : "items"} can be shown
            and ordered, out of {formatNumber(readiness.products)} in your
            catalogue.
          </span>
        </p>

        {blocked.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {blocked.map((blocker) => (
              <li key={blocker.title} className="flex items-start gap-2">
                <PackageX
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <span className="text-foreground font-medium">
                    {blocker.title}
                  </span>{" "}
                  <span className="text-muted-foreground">{blocker.fix}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardBody>
    </Card>
  );
}

interface Blocker {
  readonly title: string;
  readonly fix: string;
}

function blockers(readiness: StorefrontReadiness): readonly Blocker[] {
  const list: Blocker[] = [];

  if (readiness.products === 0) {
    list.push({
      title: "Your catalogue is empty.",
      fix: "Add a product and the chat will start offering it.",
    });

    return list;
  }

  if (readiness.productsWithoutVariant > 0) {
    list.push({
      title: `${formatNumber(readiness.productsWithoutVariant)} active ${
        readiness.productsWithoutVariant === 1 ? "product has" : "products have"
      } no variant.`,
      fix: "A variant holds the price, the SKU and the stock, so a product without one cannot be ordered. Open the product and add one.",
    });
  }

  if (readiness.draftProducts > 0) {
    list.push({
      title: `${formatNumber(readiness.draftProducts)} ${
        readiness.draftProducts === 1 ? "product is" : "products are"
      } still a draft.`,
      fix: "Drafts are hidden from customers. Set the status to Active to publish them.",
    });
  }

  if (readiness.outOfStock > 0) {
    list.push({
      title: `${formatNumber(readiness.outOfStock)} ${
        readiness.outOfStock === 1 ? "item is" : "items are"
      } out of stock.`,
      fix: "These are shown with an 'out of stock' label and cannot be ordered until you restock them.",
    });
  }

  if (readiness.untracked > 0) {
    list.push({
      title: `${formatNumber(readiness.untracked)} ${
        readiness.untracked === 1 ? "item sells" : "items sell"
      } without a stock count.`,
      fix: "That is fine — no quantity is quoted and orders are not capped. Set a quantity on the variant if you want the shop to keep count.",
    });
  }

  return list;
}
