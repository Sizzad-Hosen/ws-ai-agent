import type {
  RegistrationCheckStatus,
  RegistrationCheckType,
  RegistrationStatus,
} from "@/types/status";

/** `tenant_registrations`. */
export interface TenantRegistration {
  readonly id: string;
  readonly registrationCode: string;
  readonly businessName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly ownerPhone: string;
  readonly industry: string;
  readonly region: string;
  readonly requestedPlanId: string | null;
  readonly status: RegistrationStatus;
  /**
   * `tenant_registrations.created_at`. Not on the ERD; added so screen 03 can
   * show a real "Signed up" date and the review queue can order by arrival —
   * see D-34 in docs/IMPLEMENTATION_PLAN.md.
   */
  readonly submittedAt: string;
}

/** `tenant_registration_checks`. */
export interface RegistrationCheck {
  readonly id: string;
  readonly registrationId: string;
  readonly checkType: RegistrationCheckType;
  readonly status: RegistrationCheckStatus;
  readonly notes: string | null;
  readonly checkedAt: string | null;
  /** ERD stores a bare UUID here; resolved to a name for display (2.9c). */
  readonly checkedByName: string | null;
}

export interface RegistrationDetail {
  readonly registration: TenantRegistration;
  readonly requestedPlanName: string | null;
  readonly checks: readonly RegistrationCheck[];
  /** WhatsApp Business API number captured at registration (screen 03). */
  readonly whatsappBusinessNumber: string | null;
}

export const REGISTRATION_CHECK_LABELS: Readonly<
  Record<RegistrationCheckType, { title: string; description: string }>
> = {
  business_verification: {
    title: "Business Verification",
    description: "Documents verified via automated check.",
  },
  payment_method_linked: {
    title: "Payment Method Linked",
    description: "Billing customer record established.",
  },
  whatsapp_api_approval: {
    title: "WhatsApp API Approval",
    description: "Pending Meta business verification.",
  },
};

/**
 * Screen 03: "All checks must pass before final approval." Enforced on the
 * server as well as in the UI — a disabled button is not an access control.
 */
export function allChecksPassed(checks: readonly RegistrationCheck[]): boolean {
  return (
    checks.length > 0 && checks.every((check) => check.status === "passed")
  );
}

export function countPassedChecks(
  checks: readonly RegistrationCheck[],
): number {
  return checks.filter((check) => check.status === "passed").length;
}
