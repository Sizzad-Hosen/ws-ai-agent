import type { Metadata } from "next";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  MessageSquare,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Field } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { env } from "@/config/env";
import { TenantShell } from "@/features/tenant-dashboard/components/tenant-shell";
import {
  CONNECTION_LABELS,
  CONNECTION_STEPS,
  CONNECTION_TONES,
  readableError,
  stepIndexOf,
  viewFor,
  type ConnectionState,
} from "@/features/tenant-whatsapp/connection";
import { loadTenantWhatsapp } from "@/features/tenant-whatsapp/whatsapp-service";
import { requireTenantPage } from "@/server/tenancy/tenant-guard";
import {
  formatNumber,
  formatRelativeTime,
  formatTimestamp,
} from "@/utils/format";

export const metadata: Metadata = {
  title: "WhatsApp",
  robots: { index: false, follow: false },
};

export default async function TenantWhatsappPage({
  params,
}: PageProps<"/[tenant]/tenants_reg/whatsapp">) {
  const { tenant: slug } = await params;
  const { tenant, user } = await requireTenantPage(slug);

  // Whether the platform has a Meta app at all. The app id is public — the
  // popup needs it — but the secret is never read here and never sent down.
  const platformConfigured =
    env.META_APP_ID !== "" && env.META_CONFIG_ID !== "";

  const view = await loadTenantWhatsapp(tenant.id, platformConfigured);
  const state = view.connection?.state ?? null;
  const screen = viewFor(state);

  return (
    <TenantShell
      tenant={tenant}
      user={user}
      title="WhatsApp"
      description="Connect your WhatsApp Business number so the AI agent can answer customers."
      actions={
        state ? (
          <Badge tone={CONNECTION_TONES[state]}>
            {CONNECTION_LABELS[state]}
          </Badge>
        ) : null
      }
    >
      {screen === "live" && view.connection ? (
        <LiveState connection={view.connection} />
      ) : null}

      {screen === "connecting" && state ? (
        <ConnectingState state={state} />
      ) : null}

      {screen === "failed" ? (
        <FailedState
          errorCode={
            view.lastAttempt?.errorCode ?? view.connection?.lastError ?? null
          }
          errorMessage={view.lastAttempt?.errorMessage ?? null}
        />
      ) : null}

      {screen === "not-connected" ? (
        <NotConnectedState
          platformConfigured={platformConfigured}
          previouslyDisconnected={state === "DISCONNECTED"}
        />
      ) : null}
    </TenantShell>
  );
}

/* ------------------------------------------------------------------ live */

function LiveState({
  connection,
}: {
  readonly connection: NonNullable<
    Awaited<ReturnType<typeof loadTenantWhatsapp>>["connection"]
  >;
}) {
  const now = new Date();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Number"
          value={connection.displayPhoneNumber ?? "—"}
          caption={connection.verifiedName ?? "No verified name yet"}
        />
        <MetricCard
          label="Quality rating"
          value={connection.qualityRating ?? "Not rated yet"}
          caption="Set by Meta from customer feedback"
          accent={connection.qualityRating === "GREEN" ? "success" : "default"}
        />
        <MetricCard
          label="Messaging limit"
          value={connection.messagingLimit ?? "Standard"}
          caption="How many people you may start a chat with daily"
        />
        <MetricCard
          label="Events today"
          value={formatNumber(connection.eventsLastDay)}
          caption={
            connection.lastWebhookAt
              ? `Last ${formatRelativeTime(connection.lastWebhookAt, now)}`
              : "Nothing received yet"
          }
        />
      </div>

      {connection.lastWebhookAt === null ? (
        <Card className="border-warning/40">
          <CardBody className="flex items-start gap-3">
            <TriangleAlert
              className="text-warning mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Connected, but nothing has arrived</p>
              <p className="text-muted-foreground max-w-prose">
                Your number is subscribed and we are waiting for the first
                message. Send a WhatsApp message to{" "}
                {connection.displayPhoneNumber ?? "your number"} from another
                phone to check it end to end.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Connection" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Display number">
            {connection.displayPhoneNumber ?? "—"}
          </Field>
          <Field label="Verified name">
            {connection.verifiedName ?? "Not set"}
          </Field>
          <Field label="Phone number ID">
            <span className="font-mono text-[13px]">
              {connection.phoneNumberId}
            </span>
          </Field>
          <Field label="WhatsApp Business Account">
            <span className="font-mono text-[13px]">{connection.wabaId}</span>
          </Field>
          <Field label="Subscribed">
            {connection.subscribedAt
              ? formatTimestamp(connection.subscribedAt)
              : "—"}
          </Field>
          <Field label="Access renews">
            {connection.tokenExpiresAt
              ? formatTimestamp(connection.tokenExpiresAt)
              : "Does not expire"}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Test and disconnect"
          description="Sending a test message and disconnecting are not built yet."
        />
        <CardBody className="flex flex-wrap gap-3">
          <Button
            disabled
            title="Sending a test message is not implemented yet."
          >
            Send a test message
          </Button>
          <Button
            variant="danger"
            disabled
            title="Disconnecting is not implemented yet."
          >
            Disconnect
          </Button>
        </CardBody>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------ connecting */

function ConnectingState({ state }: { readonly state: ConnectionState }) {
  const current = stepIndexOf(state);

  return (
    <Card>
      <CardHeader
        title="Connecting your number"
        description="This takes a few seconds. Leave the page open."
      />
      <CardBody>
        <ol className="space-y-4">
          {CONNECTION_STEPS.map((step, index) => {
            const done = index < current;
            const active = index === current;

            return (
              <li key={step.state} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                    done
                      ? "bg-success-container"
                      : active
                        ? "bg-info-container"
                        : "bg-muted"
                  }`}
                  aria-hidden="true"
                >
                  {done ? (
                    <Check className="text-success size-3.5" />
                  ) : active ? (
                    <LoaderCircle className="text-info size-3.5 animate-spin" />
                  ) : (
                    <span className="text-muted-foreground text-[11px]">
                      {index + 1}
                    </span>
                  )}
                </span>

                <span className="min-w-0">
                  <span
                    className={`block text-sm ${done || active ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {step.label}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {step.detail}
                  </span>
                </span>

                <span className="ml-auto text-xs">
                  {done ? (
                    <span className="text-success">Done</span>
                  ) : active ? (
                    <span className="text-info">In progress</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------- failed */

function FailedState({
  errorCode,
  errorMessage,
}: {
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}) {
  const { sentence, code } = readableError(errorCode, errorMessage);

  return (
    <Card className="border-destructive/40">
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          <CircleAlert
            className="text-destructive mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <p className="font-medium">We could not connect your number</p>
            <p className="text-muted-foreground max-w-prose text-sm">
              {sentence}
            </p>
            {code ? (
              <p className="text-muted-foreground text-xs">
                Reference for support: <span className="font-mono">{code}</span>
              </p>
            ) : null}
          </div>
        </div>

        <Button disabled title="The connect flow is not implemented yet.">
          Try again
        </Button>
      </CardBody>
    </Card>
  );
}

/* --------------------------------------------------------- not connected */

function NotConnectedState({
  platformConfigured,
  previouslyDisconnected,
}: {
  readonly platformConfigured: boolean;
  readonly previouslyDisconnected: boolean;
}) {
  return (
    <>
      <Card>
        <CardBody className="flex flex-col items-start gap-4 py-10 text-center sm:items-center">
          <span
            className="bg-success-container grid size-12 place-items-center rounded-full"
            aria-hidden="true"
          >
            <MessageSquare className="text-success size-6" />
          </span>

          <div className="space-y-2 sm:max-w-prose">
            <h2 className="text-lg font-semibold">
              {previouslyDisconnected
                ? "Your number is disconnected"
                : "Connect your WhatsApp Business number"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {previouslyDisconnected
                ? "Messages are not reaching your workspace. Reconnect to start receiving them again."
                : "You will sign in with Meta in a popup and choose your business and number. We never see your Meta password, and your number stays yours."}
            </p>
          </div>

          <Button
            disabled
            title={
              platformConfigured
                ? "The connect flow is not implemented yet."
                : "The platform has not finished its Meta app setup."
            }
          >
            {previouslyDisconnected ? "Reconnect" : "Connect WhatsApp"}
          </Button>

          {!platformConfigured ? (
            <p className="text-muted-foreground text-xs">
              Connecting is unavailable until the platform operator finishes
              setting up its Meta app.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What happens when you connect" />
        <CardBody>
          <ol className="space-y-4">
            {CONNECTION_STEPS.map((step, index) => (
              <li key={step.state} className="flex items-start gap-3">
                <span
                  className="bg-muted text-muted-foreground mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px]"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {step.label}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </>
  );
}
