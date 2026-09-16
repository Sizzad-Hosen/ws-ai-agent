import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { tenantHref } from "@/features/tenant-dashboard/routes";
import { translate, type Locale } from "@/lib/i18n/translate";

import { ConnectWhatsappButton } from "./connect-whatsapp-dialog";

/**
 * The WhatsApp channel, connected or not.
 *
 * One card with two states rather than two cards, because a shop owner reads
 * this page to answer one question — is my WhatsApp working — and a layout
 * that answers it in a different place depending on the answer makes them look
 * twice.
 *
 * A Server Component. Only the connect dialog is a client island, so the
 * Facebook SDK loader and the modal state do not pull the whole page into the
 * browser bundle.
 */

interface ConnectedChannel {
  readonly verifiedName: string | null;
  readonly displayPhoneNumber: string | null;
  readonly live: boolean;
}

interface WhatsappChannelCardProps {
  readonly slug: string;
  readonly locale: Locale;
  readonly productName: string;
  readonly partnerBusinessId: string;
  readonly embeddedSignupReady: boolean;
  /** Null when this workspace has connected no number yet. */
  readonly channel: ConnectedChannel | null;
}

export function WhatsappChannelCard({
  slug,
  locale,
  productName,
  partnerBusinessId,
  embeddedSignupReady,
  channel,
}: WhatsappChannelCardProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const connected = channel !== null && channel.live;

  return (
    <div
      className={
        connected
          ? "rounded-xl border-2 border-emerald-400 bg-emerald-50/30 p-4"
          : "border-border rounded-xl border-2 border-dashed p-4"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <MessageCircle
            className="size-4 text-emerald-600"
            aria-hidden="true"
          />
          <span className="text-foreground text-sm font-medium">
            {t("integrations.whatsapp")}
          </span>
        </span>

        <span
          className={
            connected
              ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
              : "text-muted-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          }
        >
          <span
            className={
              connected
                ? "size-1.5 rounded-full bg-emerald-500"
                : "bg-muted-foreground/50 size-1.5 rounded-full"
            }
            aria-hidden="true"
          />
          {connected
            ? t("integrations.connected")
            : t("integrations.notConnected")}
        </span>
      </div>

      {connected ? (
        <>
          <p className="text-foreground mb-1 text-center text-base font-semibold">
            {channel.verifiedName ?? t("integrations.whatsapp")}
          </p>
          {channel.displayPhoneNumber ? (
            <p className="text-muted-foreground mb-4 text-center font-mono text-xs">
              {channel.displayPhoneNumber}
            </p>
          ) : null}

          {/*
            Both links land on the WhatsApp screen, which is where the health
            panel and the real disconnect control live. The card is a shortcut,
            not a second place to perform the action — one confirm dialog for
            disconnecting is enough, and it belongs next to what it affects.
          */}
          <div className="space-y-2">
            <Button variant="secondary" className="w-full" asChild>
              <Link href={tenantHref(slug, "whatsapp")}>
                {t("integrations.goToChats")}
              </Link>
            </Button>
            <Button variant="danger" className="w-full" asChild>
              <Link href={tenantHref(slug, "whatsapp")}>
                {t("integrations.disconnect")}
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mb-4 min-h-[2.5rem] text-sm">
            {t("integrations.whatsappPurpose")}
          </p>

          <ConnectWhatsappButton
            slug={slug}
            locale={locale}
            productName={productName}
            partnerBusinessId={partnerBusinessId}
            embeddedSignupReady={embeddedSignupReady}
            label={t("integrations.connectWhatsapp")}
          />
        </>
      )}
    </div>
  );
}
