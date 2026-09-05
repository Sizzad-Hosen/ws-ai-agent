"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { useId, useState } from "react";

import { ROUTES } from "@/constants/routes";
import type { PublicPlan } from "@/features/public-site/pricing";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/utils/format";

import { PsButton } from "./ui";

type Billing = "monthly" | "annual";

interface PricingTableProps {
  readonly plans: readonly PublicPlan[];
  readonly savingPercent: number;
}

export function PricingTable({ plans, savingPercent }: PricingTableProps) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const groupId = useId();

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="border-ps-edge bg-ps-panel mx-auto flex w-fit gap-1 rounded-full border p-1"
      >
        <BillingOption
          name={groupId}
          label="Monthly"
          checked={billing === "monthly"}
          onSelect={() => setBilling("monthly")}
        />
        <BillingOption
          name={groupId}
          label="Annually"
          badge={savingPercent > 0 ? `-${savingPercent}%` : undefined}
          checked={billing === "annual"}
          onSelect={() => setBilling("annual")}
        />
      </div>

      <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanColumn key={plan.id} plan={plan} billing={billing} />
        ))}
      </div>
    </div>
  );
}

function BillingOption({
  name,
  label,
  badge,
  checked,
  onSelect,
}: {
  readonly name: string;
  readonly label: string;
  readonly badge?: string;
  readonly checked: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors",
        checked
          ? "bg-ps-ink text-white"
          : "text-ps-ink-muted hover:text-ps-ink",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {label}
      {badge ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            checked ? "bg-white/20" : "bg-ps-brand-wash text-ps-brand-deep",
          )}
        >
          {badge}
        </span>
      ) : null}
    </label>
  );
}

function PlanColumn({
  plan,
  billing,
}: {
  readonly plan: PublicPlan;
  readonly billing: Billing;
}) {
  const perMonth =
    billing === "annual" ? plan.monthlyPriceAnnual : plan.monthlyPrice;
  const price = formatMoney(perMonth, plan.currency);
  const annualTotal = formatMoney(plan.annualTotal, plan.currency);
  // A tier with no price is negotiated, so it routes to sales, not to signup.
  const negotiated = plan.monthlyPrice === null;

  return (
    <div
      className={cn(
        "rounded-card border p-8",
        plan.popular
          ? "border-ps-brand/40 bg-ps-panel shadow-float ring-ps-brand/10 ring-4"
          : "border-ps-edge bg-ps-panel",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-ps-ink font-display text-xl font-semibold">
          {plan.name}
        </h3>
        {plan.popular ? (
          <span className="bg-ps-brand-wash text-ps-brand-deep font-display text-eyebrow rounded-full px-3 py-1 uppercase">
            Popular
          </span>
        ) : null}
      </div>

      {plan.description ? (
        <p className="text-ps-ink-muted mt-3 text-sm leading-relaxed">
          {plan.description}
        </p>
      ) : null}

      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="text-ps-ink font-display text-4xl font-semibold">
          {price ?? "Custom"}
        </span>
        {price ? <span className="text-ps-ink-muted text-sm">/mo</span> : null}
      </p>

      {billing === "annual" && annualTotal ? (
        <p className="text-ps-ink-subtle mt-1.5 text-xs">
          {annualTotal} billed annually
        </p>
      ) : (
        <p className="text-ps-ink-subtle mt-1.5 text-xs">
          {negotiated ? "Tailored to your volume" : "Billed monthly"}
        </p>
      )}

      {plan.highlights.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {plan.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2.5 text-sm">
              <CircleCheck
                className="text-ps-brand mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span className="text-ps-ink-muted">{highlight}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <PsButton
        asChild
        variant={plan.popular ? "primary" : "secondary"}
        className="mt-8 w-full"
      >
        <Link href={ROUTES.public.register}>
          {negotiated ? "Contact Sales" : `Start ${plan.name}`}
        </Link>
      </PsButton>
    </div>
  );
}
