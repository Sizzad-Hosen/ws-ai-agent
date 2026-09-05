import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";

import { RegisterForm } from "@/features/public-site/components/register-form";
import { repositories } from "@/server/repositories";

export const metadata: Metadata = {
  title: "Start free",
  description:
    "Create your SellPilot AI workspace. Applications are reviewed before provisioning; no card required.",
};

const ASSURANCES = [
  "No credit card required to apply.",
  "Your WhatsApp number stays yours — we connect to it, we don't replace it.",
  "A reviewer checks every workspace before it goes live.",
] as const;

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const params = await searchParams;
  const requested = typeof params.plan === "string" ? params.plan : "";

  const plans = (await repositories.plans.findAll())
    .filter((item) => item.plan.isActive)
    .map((item) => ({ code: item.plan.code, name: item.plan.name }));

  // A ?plan= that no longer exists falls back to "not sure yet" rather than
  // preselecting something the applicant never chose.
  const defaultPlanCode = plans.some((plan) => plan.code === requested)
    ? requested
    : "";

  return (
    <section className="section-ps">
      <div className="container-ps grid items-start gap-12 lg:grid-cols-[1fr_minmax(0,32rem)]">
        <div className="max-w-lg">
          <h1 className="text-ps-ink font-display text-display-md text-balance">
            Start selling on WhatsApp
          </h1>
          <p className="text-ps-ink-muted text-lead mt-6 text-pretty">
            Tell us about your business and we&apos;ll prepare your workspace.
            Setup takes minutes once your application is approved.
          </p>

          <ul className="mt-8 space-y-3">
            {ASSURANCES.map((assurance) => (
              <li key={assurance} className="flex items-start gap-2.5">
                <CircleCheck
                  className="text-ps-brand mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="text-ps-ink-muted text-sm">{assurance}</span>
              </li>
            ))}
          </ul>
        </div>

        <RegisterForm planOptions={plans} defaultPlanCode={defaultPlanCode} />
      </div>
    </section>
  );
}
