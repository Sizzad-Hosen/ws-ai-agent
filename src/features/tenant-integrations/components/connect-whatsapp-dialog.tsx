"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { translate, type Locale } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

import { ManualSetupTab } from "./manual-setup-tab";
import { QuickConnectTab } from "./quick-connect-tab";

/**
 * The Connect WhatsApp modal.
 *
 * Two tabs over one goal, because the two paths suit different shops and a
 * shop owner cannot be asked to work out which. Quick connect is Meta's
 * Embedded Signup and finishes in a popup. Manual setup is partner access: the
 * tenant grants us permission from their own Meta Business Settings, and never
 * opens a developer console.
 *
 * The tabs are local state rather than routes. A modal that changed the URL
 * would put a half-finished connection in the browser history, and reopening
 * that entry would drop a tenant into step 5 with no context.
 */

export type ConnectTab = "quick" | "manual";

interface ConnectWhatsappDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly slug: string;
  readonly locale: Locale;
  readonly productName: string;
  /** Empty when this deployment is not an approved Meta partner yet. */
  readonly partnerBusinessId: string;
  /** False when the platform has no Meta app configured. */
  readonly embeddedSignupReady: boolean;
}

export function ConnectWhatsappDialog({
  open,
  onClose,
  slug,
  locale,
  productName,
  partnerBusinessId,
  embeddedSignupReady,
}: ConnectWhatsappDialogProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [tab, setTab] = useState<ConnectTab>("quick");

  const tabs: readonly { readonly id: ConnectTab; readonly label: string }[] = [
    { id: "quick", label: t("connect.tabQuick") },
    { id: "manual", label: t("connect.tabManual") },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("integrations.connectWhatsapp")}
      description={t("integrations.whatsappPurpose")}
      closeLabel={t("integrations.close")}
      icon={
        <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>
      }
    >
      <div
        role="tablist"
        aria-label={t("integrations.connectWhatsapp")}
        className="bg-muted/60 mb-5 grid grid-cols-2 gap-1 rounded-lg p-1"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`connect-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`connect-panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              tab === item.id
                ? "bg-card text-primary-deep shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`connect-panel-${tab}`}
        aria-labelledby={`connect-tab-${tab}`}
      >
        {tab === "quick" ? (
          <QuickConnectTab
            slug={slug}
            locale={locale}
            ready={embeddedSignupReady}
            onUseManual={() => setTab("manual")}
          />
        ) : (
          <ManualSetupTab
            slug={slug}
            locale={locale}
            productName={productName}
            partnerBusinessId={partnerBusinessId}
          />
        )}
      </div>
    </Dialog>
  );
}

/** The button that opens the dialog, and the dialog's own open state. */
export function ConnectWhatsappButton(
  props: Omit<ConnectWhatsappDialogProps, "open" | "onClose"> & {
    readonly label: string;
    readonly variant?: "primary" | "secondary";
  },
) {
  const { label, variant = "primary", ...dialogProps } = props;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>

      <ConnectWhatsappDialog
        {...dialogProps}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
