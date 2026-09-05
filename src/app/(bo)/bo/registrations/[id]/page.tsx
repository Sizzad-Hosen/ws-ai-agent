import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Ban,
  CircleCheck,
  EllipsisVertical,
  Globe,
  Hash,
  MessageSquare,
  Store,
  Tag,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PLATFORM_PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { ReviewChecklist } from "@/features/registrations/components/review-checklist";
import { allChecksPassed } from "@/features/registrations/types";
import { hasPermission, requirePermission } from "@/server/auth/authorization";
import { repositories } from "@/server/repositories";
import { formatOptionalDate } from "@/utils/format";

export const metadata: Metadata = {
  title: "Registration Review",
};

export default async function RegistrationReviewPage({
  params,
}: PageProps<"/bo/registrations/[id]">) {
  const admin = await requirePermission(PLATFORM_PERMISSIONS.TENANTS_READ);
  const { id } = await params;

  const detail = await repositories.registrations.findDetailById(id);

  if (!detail) {
    notFound();
  }

  const { registration, checks, requestedPlanName, whatsappBusinessNumber } =
    detail;
  const canManage = hasPermission(
    admin.role,
    PLATFORM_PERMISSIONS.TENANTS_MANAGE,
  );
  const readyToApprove = allChecksPassed(checks);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Tenants", href: ROUTES.bo.tenants },
          { label: "Registration Review", href: ROUTES.bo.registrations },
          { label: registration.businessName },
        ]}
        title={registration.businessName}
        meta={
          <Badge tone="warning" dot>
            Pending Review
          </Badge>
        }
        description={
          <span className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Hash className="size-3.5" aria-hidden="true" />
              <span className="tabular">
                Reg: {registration.registrationCode}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Tag className="size-3.5" aria-hidden="true" />
              Submitted {formatOptionalDate(registration.submittedAt)}
            </span>
          </span>
        }
        actions={
          canManage ? (
            <>
              <Button variant="danger">
                <Ban className="size-4" aria-hidden="true" />
                Reject
              </Button>
              <Button
                disabled={!readyToApprove}
                title={
                  readyToApprove
                    ? undefined
                    : "All checks must pass before final approval."
                }
              >
                <CircleCheck className="size-4" aria-hidden="true" />
                Approve Tenant
              </Button>
              <Button variant="secondary" size="icon" aria-label="More actions">
                <EllipsisVertical className="size-4" aria-hidden="true" />
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-t-primary-container border-t-2">
            <CardBody className="grid gap-6 pt-5 sm:grid-cols-2">
              <Field label="Owner">
                <span className="flex items-center gap-3">
                  <Avatar name={registration.ownerName} size="sm" />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {registration.ownerName}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {registration.ownerEmail}
                    </span>
                  </span>
                </span>
              </Field>

              <Field label="Applied Plan">
                <span className="flex flex-wrap items-center gap-3">
                  {requestedPlanName ? (
                    <Badge shape="tag" tone="info">
                      {requestedPlanName}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      No plan selected
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    Signed up: {formatOptionalDate(registration.submittedAt)}
                  </span>
                </span>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Business Details"
              icon={<Store className="size-4" aria-hidden="true" />}
            />
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Field label="Industry">
                <span className="inline-flex items-center gap-2">
                  <Tag
                    className="text-muted-foreground size-3.5"
                    aria-hidden="true"
                  />
                  {registration.industry}
                </span>
              </Field>
              <Field label="Region">
                <span className="inline-flex items-center gap-2">
                  <Globe
                    className="text-muted-foreground size-3.5"
                    aria-hidden="true"
                  />
                  {registration.region}
                </span>
              </Field>
              <Field label="WhatsApp Business API">
                {whatsappBusinessNumber ? (
                  <span className="inline-flex items-center gap-2">
                    <MessageSquare
                      className="text-success size-3.5"
                      aria-hidden="true"
                    />
                    <span className="tabular">{whatsappBusinessNumber}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </Field>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="pt-5">
            <ReviewChecklist checks={checks} canManage={canManage} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
