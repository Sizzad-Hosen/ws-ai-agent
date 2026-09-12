"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { readableError } from "@/features/tenant-whatsapp/connection";

/**
 * The Embedded Signup button.
 *
 * The browser's whole job is to open Meta's popup and hand back what it
 * returns. It never sees the app secret, never talks to the Graph API, and its
 * claims about which business account this is are treated as claims — the
 * callback verifies them server-side before anything is stored.
 *
 * Meta's SDK is loaded from connect.facebook.net, which is the only place it
 * exists. If it does not load — blocked, offline, an ad blocker — the button
 * says so rather than doing nothing when clicked.
 */

interface FacebookLoginResponse {
  readonly authResponse?: { readonly code?: string } | null;
  readonly status?: string;
}

interface FacebookSdk {
  init(options: Record<string, unknown>): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options: Record<string, unknown>,
  ): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

interface StartPayload {
  readonly sessionId: string;
  readonly stateNonce: string;
  readonly appId: string;
  readonly configId: string;
}

/** What Meta posts to the opener as the user moves through the popup. */
interface SignupMessage {
  readonly type?: string;
  readonly event?: string;
  readonly data?: {
    readonly phone_number_id?: string;
    readonly waba_id?: string;
    readonly current_step?: string;
  };
}

interface ConnectButtonProps {
  readonly slug: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

export function ConnectButton({
  slug,
  label,
  disabled = false,
  disabledReason,
}: ConnectButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // What the popup reported, held until the code arrives. Meta delivers the
  // ids by postMessage and the code by callback, and they can land in either
  // order — a ref rather than state because the callback closes over it.
  const reported = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  // Readiness is deliberately not held in state. window.FB is the only
  // truth about whether the SDK loaded, and it is checked at click time — so
  // mirroring it into a state variable would add a second, staler copy and a
  // render cascade for nothing.
  useEffect(() => {
    if (window.FB || document.getElementById("facebook-jssdk")) return;

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onerror = () =>
      setMessage(
        "Meta's sign-in script could not load. An ad blocker or a network " +
          "restriction is the usual cause.",
      );

    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      // Only Meta may tell us which account was chosen.
      if (event.origin !== "https://www.facebook.com") return;

      let payload: SignupMessage;

      try {
        payload =
          typeof event.data === "string"
            ? (JSON.parse(event.data) as SignupMessage)
            : (event.data as SignupMessage);
      } catch {
        return;
      }

      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.data?.waba_id) {
        reported.current.wabaId = payload.data.waba_id;
      }

      if (payload.data?.phone_number_id) {
        reported.current.phoneNumberId = payload.data.phone_number_id;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const finish = useCallback(
    async (start: StartPayload, code: string, pin: string) => {
      const response = await fetch(
        `/api/whatsapp/onboarding/callback?tenant=${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stateNonce: start.stateNonce,
            code,
            wabaId: reported.current.wabaId ?? "",
            phoneNumberId: reported.current.phoneNumberId ?? "",
            pin,
          }),
        },
      );

      const body: unknown = await response.json().catch(() => null);
      const data =
        body && typeof body === "object" && "data" in body
          ? (
              body as {
                data: { connected?: boolean; errorCode?: string | null };
              }
            ).data
          : null;

      if (data?.connected) {
        router.refresh();
        return;
      }

      setMessage(readableError(data?.errorCode ?? null).sentence);
      setBusy(false);
      router.refresh();
    },
    [router, slug],
  );

  async function onClick(): Promise<void> {
    setMessage(null);
    setBusy(true);
    reported.current = {};

    // The two-step PIN is Meta's, set on the number, and we cannot look it up.
    const pin = window.prompt(
      "Enter the six-digit two-step PIN for this WhatsApp number.\n\n" +
        "If the number is new, choose a PIN now and keep it: Meta will ask " +
        "for it again.",
    );

    if (pin === null) {
      setBusy(false);
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setMessage("The PIN must be six digits.");
      setBusy(false);
      return;
    }

    let start: StartPayload;

    try {
      const response = await fetch(
        `/api/whatsapp/onboarding/start?tenant=${encodeURIComponent(slug)}`,
        { method: "POST" },
      );

      const body: unknown = await response.json().catch(() => null);

      if (
        !response.ok ||
        !body ||
        typeof body !== "object" ||
        !("data" in body)
      ) {
        const error =
          body && typeof body === "object" && "error" in body
            ? (body as { error: { message?: string } }).error?.message
            : null;

        setMessage(error ?? "Could not start the connection. Try again.");
        setBusy(false);
        return;
      }

      start = (body as { data: StartPayload }).data;
    } catch {
      setMessage("Could not reach the server. Check your connection.");
      setBusy(false);
      return;
    }

    if (!window.FB) {
      setMessage(
        "Meta's sign-in has not loaded yet. Wait a moment and try again, or " +
          "check whether an ad blocker is stopping it.",
      );
      setBusy(false);
      return;
    }

    window.FB.init({
      appId: start.appId,
      cookie: true,
      xfbml: false,
      version: "v21.0",
    });

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;

        if (!code) {
          setMessage(readableError("1006").sentence);
          setBusy(false);
          return;
        }

        void finish(start, code, pin);
      },
      {
        config_id: start.configId,
        response_type: "code",
        // The nonce travels with the popup so Meta echoes it back, and is
        // checked server-side against the session this started.
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
          state: start.stateNonce,
        },
      },
    );
  }

  const isDisabled = disabled || busy;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isDisabled}
        onClick={() => void onClick()}
        title={disabled ? disabledReason : undefined}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {busy ? "Connecting…" : label}
      </Button>

      {message ? (
        <p className="text-destructive max-w-prose text-xs" role="alert">
          {message}
        </p>
      ) : null}

      {disabled && disabledReason ? (
        <p className="text-muted-foreground max-w-prose text-xs">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
