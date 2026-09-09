import { ROUTES } from "@/constants/routes";

export interface PublicNavItem {
  readonly label: string;
  readonly href: string;
}

/**
 * Primary navigation.
 *
 * The mockups label the third slot "Solutions" on most screens and "Services"
 * on 04; "Solutions" is used throughout, since two names for one destination
 * is a defect rather than a design.
 */
export const PUBLIC_NAV: readonly PublicNavItem[] = [
  { label: "Product", href: ROUTES.public.product },
  { label: "Solutions", href: ROUTES.public.solutions },
  { label: "Resources", href: ROUTES.public.demo },
  { label: "Pricing", href: ROUTES.public.pricing },
  { label: "FAQ", href: ROUTES.public.faq },
  { label: "Company", href: ROUTES.public.company },
];

export interface FooterColumn {
  readonly title: string;
  readonly links: readonly PublicNavItem[];
}

export const PUBLIC_FOOTER: readonly FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: ROUTES.public.product },
      { label: "Live demo", href: ROUTES.public.demo },
      { label: "Pricing", href: ROUTES.public.pricing },
      { label: "FAQ", href: ROUTES.public.faq },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Industries", href: ROUTES.public.solutions },
      {
        label: "Fashion & Apparel",
        href: `${ROUTES.public.solutions}#fashion`,
      },
      { label: "Grocery & Retail", href: `${ROUTES.public.solutions}#grocery` },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: ROUTES.public.company },
      { label: "Careers", href: `${ROUTES.public.company}#careers` },
      { label: "Admin sign in", href: ROUTES.auth.login },
    ],
  },
];
