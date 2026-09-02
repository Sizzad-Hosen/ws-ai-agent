"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <TriangleAlert
          className="text-destructive mx-auto size-10"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The back office could not load this view. Please try again.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
