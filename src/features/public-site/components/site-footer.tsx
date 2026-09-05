import Link from "next/link";

import { PUBLIC_FOOTER } from "@/features/public-site/navigation";

interface SiteFooterProps {
  readonly brandName: string;
  readonly supportEmail: string;
}

export function SiteFooter({ brandName, supportEmail }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-ps-edge bg-ps-page border-t">
      <div className="container-ps grid gap-10 py-16 md:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="space-y-3">
          <p className="text-ps-ink font-display text-xl font-semibold tracking-tight">
            {brandName}
          </p>
          <p className="text-ps-ink-subtle max-w-xs text-sm">
            Automating sales workflows so you can focus on building
            relationships.
          </p>
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}`}
              className="text-ps-brand-deep hover:text-ps-brand-deep/80 inline-block text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {supportEmail}
            </a>
          ) : null}
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {PUBLIC_FOOTER.map((column) => (
            <div key={column.title}>
              <h2 className="text-ps-ink font-display text-eyebrow uppercase">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-ps-ink-muted hover:text-ps-ink text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-ps-edge border-t">
        <div className="container-ps text-ps-ink-subtle py-6 text-sm">
          © {year} {brandName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
