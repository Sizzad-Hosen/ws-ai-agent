import "dotenv/config";

import {
  annualSavingPercent,
  toPublicPlans,
} from "@/features/public-site/pricing";
import { prisma } from "@/server/db/prisma";
import { repositories } from "@/server/repositories";

async function main(): Promise<void> {
  // ---- pricing reads the live catalogue --------------------------------
  const plans = toPublicPlans(await repositories.plans.findAll());

  if (plans.length === 0) {
    throw new Error("No active plans; the pricing page would be empty.");
  }

  const custom = plans.filter((p) => p.monthlyPrice === null);
  const priced = plans.filter((p) => p.monthlyPrice !== null);

  if (priced.length === 0) {
    throw new Error(
      "Every plan is negotiated; expected at least one priced tier.",
    );
  }

  for (const plan of priced) {
    if (plan.monthlyPriceAnnual === null) continue;
    if (Number(plan.monthlyPriceAnnual) > Number(plan.monthlyPrice)) {
      throw new Error(
        `${plan.name}: annual per-month (${plan.monthlyPriceAnnual}) exceeds monthly (${plan.monthlyPrice}).`,
      );
    }
  }

  const saving = annualSavingPercent(plans);
  if (saving < 0 || saving > 100) {
    throw new Error(`Annual saving out of range: ${saving}`);
  }

  // ---- registration reaches the back-office queue ------------------------
  const pendingBefore = await repositories.registrations.countPending();
  const email = `verify-${Date.now()}@example.test`;

  const code = await repositories.registrations.create({
    businessName: "Verify Public Signup",
    ownerName: "Verify Owner",
    ownerEmail: email,
    ownerPhone: "+1 555 000 1234",
    industry: "Grocery & Retail",
    region: "North America",
    requestedPlanId: priced[0]?.id ?? null,
  });

  if (!code.startsWith("REG-")) {
    throw new Error(`Unexpected registration code: ${code}`);
  }

  if (!(await repositories.registrations.existsForEmail(email))) {
    throw new Error("A pending registration was not detected as a duplicate.");
  }

  const pendingAfter = await repositories.registrations.countPending();
  if (pendingAfter !== pendingBefore + 1) {
    throw new Error(
      `Pending count did not move: ${pendingBefore} -> ${pendingAfter}`,
    );
  }

  const page = await repositories.registrations.findMany({
    status: "pending_review",
    limit: 50,
    offset: 0,
  });
  const created = page.items.find(
    (item) => item.registration.registrationCode === code,
  );

  if (!created) {
    throw new Error("The new registration is missing from the review queue.");
  }
  if (created.checks.length !== 3) {
    throw new Error(
      `Expected 3 review checks, found ${created.checks.length}.`,
    );
  }

  // ---- site settings drive the shell ------------------------------------
  const settings = await repositories.siteSettings.find();
  if (settings.brand.name === "") {
    throw new Error("Brand name is empty; the header would render unnamed.");
  }

  // ---- the FAQ page has published answers -------------------------------
  const faqs = await repositories.faqs.findPublished();

  if (faqs.length === 0) {
    throw new Error("No active FAQs; the FAQ page would be empty.");
  }

  for (const faq of faqs) {
    if (faq.question.trim() === "" || faq.answer.trim() === "") {
      throw new Error(`FAQ ${faq.id} has an empty question or answer.`);
    }
  }

  const inactive = await prisma.publicFaq.count({ where: { isActive: false } });
  if (faqs.length + inactive !== (await prisma.publicFaq.count())) {
    throw new Error("The FAQ page is not filtering on is_active.");
  }

  // Checks cascade with the registration, so the queue is left exactly as found.
  await prisma.tenantRegistration.delete({
    where: { id: created.registration.id },
  });

  if ((await repositories.registrations.countPending()) !== pendingBefore) {
    throw new Error("Failed to restore the pending registration count.");
  }

  console.log(
    `Public site verified: ${plans.length} plans (${custom.length} custom, annual saving ${saving}%), registration ${code} reached the review queue with 3 checks, ${faqs.length} published FAQs, brand "${settings.brand.name}". Queue restored.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
