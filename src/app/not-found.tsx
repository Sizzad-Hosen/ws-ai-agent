import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <FileQuestion
          className="text-muted-foreground mx-auto size-10"
          aria-hidden="true"
        />
        <p className="text-primary mt-4 text-sm font-medium">404</p>
        <h1 className="mt-1 text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The back-office page you requested does not exist.
        </p>
        <Button asChild className="mt-6">
          <Link href={ROUTES.bo.dashboard}>Return to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
