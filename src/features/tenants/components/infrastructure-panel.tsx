import { Bot, Database, MessageSquare, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TenantInfrastructure } from "@/features/tenants/types";
import {
  PROVISIONING_LABELS,
  PROVISIONING_TONES,
  WEBHOOK_STATUS_LABELS,
  WEBHOOK_STATUS_TONES,
  WHATSAPP_STATUS_LABELS,
  WHATSAPP_STATUS_TONES,
} from "@/features/tenants/status";
import { formatRelativeTime } from "@/utils/format";

interface InfrastructurePanelProps {
  readonly infrastructure: TenantInfrastructure;
  readonly now: Date;
  /** Database identifiers are shown only to admins who can act on them (S-03). */
  readonly canSeeInfrastructureIds: boolean;
  readonly canManage: boolean;
}

/**
 * Every sub-panel degrades independently: one unreachable probe must not blank
 * the others or fail the page.
 */
export function InfrastructurePanel({
  infrastructure,
  now,
  canSeeInfrastructureIds,
  canManage,
}: InfrastructurePanelProps) {
  const { whatsapp, ai, database, checkedAt } = infrastructure;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-headline-sm">Infrastructure Status</h2>
        {checkedAt ? (
          <span className="text-muted-foreground text-xs">
            checked {formatRelativeTime(checkedAt, now)}
          </span>
        ) : null}
      </div>

      <SubPanel
        icon={<MessageSquare className="size-4" aria-hidden="true" />}
        title="WhatsApp Integration"
      >
        {whatsapp ? (
          <>
            <Row label="Number">
              <span className="tabular">{whatsapp.phoneNumber}</span>
            </Row>
            <Row label="Status">
              <Badge tone={WHATSAPP_STATUS_TONES[whatsapp.connectionStatus]}>
                {WHATSAPP_STATUS_LABELS[whatsapp.connectionStatus]}
              </Badge>
            </Row>
            <Row label="Webhook">
              <Badge tone={WEBHOOK_STATUS_TONES[whatsapp.webhookStatus]}>
                {WEBHOOK_STATUS_LABELS[whatsapp.webhookStatus]}
              </Badge>
            </Row>
          </>
        ) : (
          <Unavailable label="No WhatsApp number connected." />
        )}
      </SubPanel>

      <SubPanel
        icon={<Bot className="size-4" aria-hidden="true" />}
        title="AI Engine"
      >
        {ai ? (
          <>
            <Row label="Agent">
              <Badge tone={ai.online ? "success" : "neutral"} dot>
                {ai.online ? "Online" : "Paused"}
              </Badge>
            </Row>
            <Row label="Resolution">
              <span className="tabular">{ai.resolutionRatePercent}%</span>
            </Row>
          </>
        ) : (
          <Unavailable label="AI telemetry unavailable." />
        )}
      </SubPanel>

      <SubPanel
        icon={<Database className="size-4" aria-hidden="true" />}
        title="Database Instance"
      >
        {database ? (
          <>
            <Row label="Status">
              <Badge tone={PROVISIONING_TONES[database.status]}>
                {PROVISIONING_LABELS[database.status]}
              </Badge>
            </Row>
            {canSeeInfrastructureIds ? (
              <Row label="ID">
                <span className="tabular">{database.instanceLabel}</span>
              </Row>
            ) : null}
            <Row label="Last Backup">
              <span className="tabular">
                {database.lastBackupAt
                  ? formatRelativeTime(database.lastBackupAt, now)
                  : "—"}
              </span>
            </Row>

            {database.status === "failed" ? (
              <div className="border-destructive/40 bg-destructive-container/40 mt-3 rounded-md border p-3">
                <p className="text-destructive-container-foreground flex items-start gap-2 text-xs">
                  <TriangleAlert
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {database.failureReason ??
                    "Provisioning failed. No reason was recorded."}
                </p>
                {canManage ? (
                  <Button variant="secondary" size="sm" className="mt-2">
                    Retry provisioning
                  </Button>
                ) : null}
              </div>
            ) : null}

            {database.status === "provisioning" ||
            database.status === "pending" ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Provisioning runs in the background; this panel updates when the
                job reports back.
              </p>
            ) : null}
          </>
        ) : (
          <Unavailable label="No database registered for this tenant." />
        )}
      </SubPanel>
    </div>
  );
}

function SubPanel({
  icon,
  title,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="bg-subtle border-border rounded-md border p-4">
      <h3 className="text-foreground mb-3 flex items-center gap-2 text-sm font-medium">
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground text-[13px]">{label}:</dt>
      <dd className="text-foreground text-[13px]">{children}</dd>
    </div>
  );
}

function Unavailable({ label }: { readonly label: string }) {
  return <p className="text-muted-foreground text-[13px]">{label}</p>;
}
