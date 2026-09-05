import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { PsButton } from "@/features/public-site/components/ui";

export default function PublicNotFound() {
  return (
    <section className="section-ps">
      <div className="container-ps max-w-lg text-center">
        <p className="text-ps-brand-deep font-display text-eyebrow uppercase">
          404
        </p>
        <h1 className="text-ps-ink font-display text-display-md mt-3 text-balance">
          We can&apos;t find that page
        </h1>
        <p className="text-ps-ink-muted text-lead mt-4 text-pretty">
          The link may be out of date, or the page may have moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PsButton asChild>
            <Link href={ROUTES.public.home}>Back to home</Link>
          </PsButton>
          <PsButton asChild variant="secondary">
            <Link href={ROUTES.public.pricing}>See pricing</Link>
          </PsButton>
        </div>
      </div>
    </section>
  );
}
