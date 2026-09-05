---
name: SellPilot AI
colors:
  surface: "#f8f9fa"
  surface-dim: "#d9dadb"
  surface-bright: "#f8f9fa"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f3f4f5"
  surface-container: "#edeeef"
  surface-container-high: "#e7e8e9"
  surface-container-highest: "#e1e3e4"
  on-surface: "#191c1d"
  on-surface-variant: "#3c4a42"
  inverse-surface: "#2e3132"
  inverse-on-surface: "#f0f1f2"
  outline: "#6c7a71"
  outline-variant: "#bbcabf"
  surface-tint: "#006c49"
  primary: "#006c49"
  on-primary: "#ffffff"
  primary-container: "#10b981"
  on-primary-container: "#00422b"
  inverse-primary: "#4edea3"
  secondary: "#5f5e5e"
  on-secondary: "#ffffff"
  secondary-container: "#e2dfde"
  on-secondary-container: "#636262"
  tertiary: "#585f6c"
  on-tertiary: "#ffffff"
  tertiary-container: "#9ca3b2"
  on-tertiary-container: "#323946"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#6ffbbe"
  primary-fixed-dim: "#4edea3"
  on-primary-fixed: "#002113"
  on-primary-fixed-variant: "#005236"
  secondary-fixed: "#e5e2e1"
  secondary-fixed-dim: "#c8c6c5"
  on-secondary-fixed: "#1c1b1b"
  on-secondary-fixed-variant: "#474746"
  tertiary-fixed: "#dce2f3"
  tertiary-fixed-dim: "#c0c7d6"
  on-tertiary-fixed: "#151c27"
  on-tertiary-fixed-variant: "#404754"
  background: "#f8f9fa"
  on-background: "#191c1d"
  surface-variant: "#e1e3e4"
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 64px
    fontWeight: "600"
    lineHeight: 72px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: "600"
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: "500"
    lineHeight: 40px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
    letterSpacing: "0"
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
    letterSpacing: "0"
  label-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  section-padding-desktop: 120px
  section-padding-mobile: 64px
  stack-gap-lg: 48px
  stack-gap-md: 24px
  stack-gap-sm: 12px
---

## Brand & Style

The design system is rooted in **Precision-Led Minimalism**, a style that balances the high-velocity nature of AI sales with the reliability of a premium B2B enterprise tool. It targets high-growth sales teams and marketing directors who value efficiency and clarity over visual noise.

The UI evokes an emotional response of **composed confidence**. By utilizing vast amounts of whitespace and a restricted color palette, the system communicates that the product is sophisticated enough to handle complex sales conversations autonomously. The aesthetic draws from modern SaaS aesthetics—characterized by airy layouts, subtle depth, and a focus on content over container—ensuring the AI's output remains the focal point.

## Colors

This design system utilizes a high-contrast, professional palette designed for long-form reading and data density.

- **Primary Emerald (#10B981):** A sophisticated evolution of the WhatsApp green, used strictly for primary calls-to-action, success states, and active AI indicators. It should never overwhelm the layout.
- **Charcoal Typography (#1A1A1A):** Used for all headlines and primary body copy to ensure maximum legibility and a grounded, premium feel.
- **Surface Neutrals:** The background uses a pristine Off-White (#F9FAFB) to differentiate from pure white (#FFFFFF) card surfaces, creating a subtle layered effect.
- **Glassmorphism:** Secondary elements utilize a highly transparent emerald tint with a 12px backdrop blur to imply depth without adding visual weight.

## Typography

The typography system relies on a dual-sans approach. **Geist** provides a technical, precise feel for headings and UI labels, reflecting the "AI" and "Developer" aspect of the product. **Inter** handles all body copy for its proven legibility in dashboard and conversational contexts.

Generous letter spacing (tracking) should be applied to `label-sm` to enhance the premium, "editorial" feel of the marketing site. Headlines should use tighter tracking to maintain a strong, impactful visual block.

## Layout & Spacing

This design system uses a **Strict 8px Grid System** to ensure mathematical harmony.

- **Desktop:** 12-column fluid grid with 24px gutters. Content is capped at a 1280px central container.
- **Mobile:** Single column with 16px side margins.
- **Rhythm:** Vertical rhythm is driven by large section paddings (120px+) to create a "breathable" premium experience. Elements within cards should use the `stack-gap` tokens to maintain consistency in information density.

## Elevation & Depth

Depth is communicated through **Soft Environmental Shadows** and **Tonal Layering**.

1.  **Level 0 (Base):** Off-white (#F9FAFB) page background.
2.  **Level 1 (Cards):** Pure White (#FFFFFF) surfaces with a thin 1px border (#E5E7EB).
3.  **Level 2 (Overlays):** Elements like tooltips or dropdowns use a "Soft-Diffused" shadow (0px 10px 30px rgba(0,0,0,0.04)) and a 1px border.
4.  **Glass Layer:** Used for navigation bars and secondary dashboard panels. Use `backdrop-filter: blur(12px)` with a semi-transparent white fill (rgba(255, 255, 255, 0.8)).

Avoid heavy, dark shadows. The goal is to make elements appear as if they are floating slightly above the surface in a well-lit room.

## Shapes

The shape language is defined by **Disparate Rounding**.

- **Primary Containers/Cards:** Use a large 24px radius to soften the professional tone and make the layout feel approachable and modern.
- **Interactive Elements:** Buttons and inputs use a tighter radius (12px and 8px respectively) to signify precision and clickability.
- **Conversation Bubbles:** Follow the 24px rule, but use a "tucked" corner (4px) on the side indicating the speaker to mimic standard chat UI patterns.

## Components

### Buttons

- **Primary:** Solid Charcoal (#1A1A1A) with White text. High-contrast, no shadow, 12px radius.
- **Secondary:** Transparent with a 1px border (#E5E7EB). On hover, a subtle light gray fill (#F3F4F6).
- **Ghost:** Primary Green (#10B981) text with no background, used for "Learn More" links.

### Cards

All cards must have a white background (#FFFFFF), a 24px border radius, and a 1px border (#E5E7EB). For "Premium" features, add a subtle emerald glow on hover using a 0% to 5% opacity primary color spread.

### Input Fields

Inputs use an 8px radius with a light gray border. On focus, the border transitions to Primary Emerald (#10B981) with a 4px soft outer glow in the same color (20% opacity).

### WhatsApp Conversation Mockups

- **Agent Bubble:** Primary Emerald background with white text.
- **Lead Bubble:** Light gray (#F3F4F6) background with Charcoal text.
- Use the `body-md` typography for messages to ensure realism.

### Dashboard Previews

Dashboard elements should be simplified. Use gray bars for secondary text and the Primary Emerald for "Active Status" dots and "Growth" sparklines. Ensure all dashboard panels utilize the glassmorphism effect for background surfaces to maintain the "light and airy" aesthetic.
