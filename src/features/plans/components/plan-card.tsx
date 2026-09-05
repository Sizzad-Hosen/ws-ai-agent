import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { PlanDeleteButton } from "@/features/plans/components/plan-delete-button";
import type { PlanListItem } from "@/features/plans/types";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/utils/format";

interface PlanCardProps {
  readonly item: PlanListItem;
  readonly canManage: boolean;
}

export function PlanCard({ item, canManage }: PlanCardProps) {
  const { plan, activeSubscriptions } = item;
  const popular = plan.features.popular === true;
  const price = formatMoney(plan.monthlyPrice, plan.currency);
  const annual = formatMoney(plan.annualPrice, plan.currency);

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden",
        popular && "border-primary-deep ring-primary-deep/20 ring-2",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h2
          className={cn(
            "text-headline-sm",
            popular ? "text-primary-deep" : "text-foreground",
          )}
        >
          {plan.name}
        </h2>
        {popular ? (
          <Badge tone="success">POPULAR</Badge>
        ) : plan.isActive ? (
          <Badge tone="info">ACTIVE</Badge>
        ) : (
          <Badge tone="neutral">DRAFT</Badge>
        )}
      </div>

      <div className="px-5 pt-4 pb-5">
        <p>
          <span className="text-foreground text-[2.5rem] leading-none font-semibold">
            {price ?? "Custom"}
          </span>
          {price ? (
            <span className="text-muted-foreground ml-2 text-sm">/mo</span>
          ) : null}
        </p>
        {annual ? (
          <p className="text-muted-foreground mt-2 text-xs">
            {annual} billed annually
          </p>
        ) : null}
      </div>

      <div className="bg-subtle border-border flex-1 space-y-4 border-t px-5 py-5">
        {plan.description ? (
          <p className="text-muted-foreground text-sm">{plan.description}</p>
        ) : null}

        {plan.features.toggles.length > 0 ? (
          <ul className="space-y-2.5">
            {plan.features.toggles.map((toggle) => (
              <li
                key={toggle.key}
                className="flex items-center gap-2.5 text-sm"
              >
                {toggle.enabled ? (
                  <Check
                    className="text-success size-4 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Minus
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    toggle.enabled
                      ? "text-foreground"
                      : "text-muted-foreground line-through"
                  }
                >
                  {toggle.label}
                </span>
                <span className="sr-only">
                  {toggle.enabled ? "included" : "not included"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {plan.features.highlights.length > 0 ? (
          <ul className="border-border space-y-2 border-t pt-4">
            {plan.features.highlights.map((highlight) => (
              <li
                key={highlight}
                className="text-muted-foreground flex items-start gap-2.5 text-sm"
              >
                <Check
                  className="text-primary-deep mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                {highlight}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="bg-subtle border-border space-y-2 border-t px-5 py-4">
        {canManage ? (
          <Link
            href={ROUTES.bo.planEdit(plan.id)}
            className={cn(
              buttonVariants({ variant: popular ? "brand" : "secondary" }),
              "w-full",
            )}
          >
            Edit Plan
          </Link>
        ) : null}
        {canManage ? (
          <PlanDeleteButton
            planId={plan.id}
            planName={plan.name}
            activeSubscriptions={activeSubscriptions}
          />
        ) : null}
        <p className="text-muted-foreground text-center text-xs">
          {activeSubscriptions === 0
            ? "No active subscribers"
            : `${activeSubscriptions} active subscriber${activeSubscriptions === 1 ? "" : "s"}`}
        </p>
      </div>
    </Card>
  );
}
