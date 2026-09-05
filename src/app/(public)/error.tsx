"use client";

import { useEffect } from "react";

import { PsButton } from "@/features/public-site/components/ui";

interface PublicErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function PublicError({ error, reset }: PublicErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="section-ps">
      <div className="container-ps max-w-lg text-center">
        <h1 className="text-ps-ink font-display text-display-md text-balance">
          Something went wrong
        </h1>
        <p className="text-ps-ink-muted text-lead mt-4 text-pretty">
          This page could not be loaded. Please try again in a moment.
        </p>
        {/*
          `digest` is the only detail shown. The message and stack stay server
          side: a visitor gets a reference to quote, not our internals.
        */}
        {error.digest ? (
          <p className="text-ps-ink-subtle mt-3 text-xs">
            Reference {error.digest}
          </p>
        ) : null}
        <PsButton className="mt-8" onClick={reset}>
          Try again
        </PsButton>
      </div>
    </section>
  );
}
