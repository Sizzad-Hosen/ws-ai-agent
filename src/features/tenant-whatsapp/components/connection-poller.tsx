"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Refreshes the page while a connection is mid-flight.
 *
 * The server renders the step list from the account's state, so the screen
 * advances by re-rendering rather than by holding its own copy of the flow.
 * That keeps one source of truth: if the tab is closed and reopened, the step
 * list is still correct.
 *
 * Polling stops on its own. A flow that has stalled leaves the screen showing
 * where it got to, which is more useful than a spinner that never ends.
 */
interface ConnectionPollerProps {
  /** Seconds between refreshes. */
  readonly intervalSeconds?: number;
  /** Give up after this many attempts. */
  readonly maxAttempts?: number;
}

export function ConnectionPoller({
  intervalSeconds = 3,
  maxAttempts = 40,
}: ConnectionPollerProps) {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;

    const timer = setInterval(() => {
      attempts += 1;

      if (attempts > maxAttempts) {
        clearInterval(timer);
        return;
      }

      // Cheap: the page is a server component and this re-runs its query. It
      // does not re-open a tenant database, because the connection lives in
      // the master.
      router.refresh();
    }, intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [router, intervalSeconds, maxAttempts]);

  return null;
}
