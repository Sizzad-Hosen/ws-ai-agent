---
name: Precision Enterprise
colors:
  surface: "#f8f9ff"
  surface-dim: "#cbdbf5"
  surface-bright: "#f8f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#eff4ff"
  surface-container: "#e5eeff"
  surface-container-high: "#dce9ff"
  surface-container-highest: "#d3e4fe"
  on-surface: "#0b1c30"
  on-surface-variant: "#3c4a42"
  inverse-surface: "#213145"
  inverse-on-surface: "#eaf1ff"
  outline: "#6c7a71"
  outline-variant: "#bbcabf"
  surface-tint: "#006c49"
  primary: "#006c49"
  on-primary: "#ffffff"
  primary-container: "#10b981"
  on-primary-container: "#00422b"
  inverse-primary: "#4edea3"
  secondary: "#565e74"
  on-secondary: "#ffffff"
  secondary-container: "#dae2fd"
  on-secondary-container: "#5c647a"
  tertiary: "#005ac2"
  on-tertiary: "#ffffff"
  tertiary-container: "#71a1ff"
  on-tertiary-container: "#00367a"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#6ffbbe"
  primary-fixed-dim: "#4edea3"
  on-primary-fixed: "#002113"
  on-primary-fixed-variant: "#005236"
  secondary-fixed: "#dae2fd"
  secondary-fixed-dim: "#bec6e0"
  on-secondary-fixed: "#131b2e"
  on-secondary-fixed-variant: "#3f465c"
  tertiary-fixed: "#d8e2ff"
  tertiary-fixed-dim: "#adc6ff"
  on-tertiary-fixed: "#001a42"
  on-tertiary-fixed-variant: "#004395"
  background: "#f8f9ff"
  on-background: "#0b1c30"
  surface-variant: "#d3e4fe"
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: "600"
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-dense: 8px
  stack-default: 16px
  stack-section: 48px
---

## Brand & Style

The design system is engineered for high-velocity back-office operations, drawing inspiration from the Modern Enterprise SaaS movement. It prioritizes utility, clarity, and systematic precision over decorative flair. The aesthetic is "Technical Minimalist"—utilizing generous negative space for structural sections while maintaining high data density within functional modules.

The interface should evoke a sense of absolute reliability and professional control. It employs a "Content-First" philosophy where the UI chrome recedes into the background, allowing data and actionable insights to take center stage. Key characteristics include:

- **Functional Rigor:** Every pixel serves a purpose; no unnecessary shadows or gradients.
- **Architectural Clarity:** Clear distinction between navigation, configuration, and content areas.
- **Developer-Centric Polish:** Subtle borders and monospaced numerical data to suggest technical sophistication.

## Colors

The palette is anchored in a sophisticated range of Slates and Grays to provide a neutral canvas for data.

- **Primary:** Emerald (#10b981) is used sparingly for primary actions, success states, and growth indicators.
- **Surface:** The background is a crisp Slate-50 (#f8fafc) to provide contrast against white (#ffffff) content cards and containers.
- **Typography:** Deep Slate (#0f172a) for headings to ensure maximum contrast, and Slate-600 (#64748b) for secondary body text.
- **Semantic:** High-saturation tones are reserved for status-critical information (Rose for errors, Amber for warnings, Blue for informational prompts).

## Typography

This design system utilizes **Inter** for all UI elements to ensure maximum legibility across various pixel densities. For data-heavy tables and metric values, **JetBrains Mono** may be used optionally to ensure alignment of numerical digits.

- **Scale:** A tight typographic scale is used to prevent layout shifts.
- **Hierarchy:** Use font weight (Medium/SemiBold) rather than size to denote hierarchy in dense layouts.
- **Utility:** Small labels should use uppercase with slight letter spacing to differentiate them from interactive text.

## Layout & Spacing

The design system employs a **12-column fluid grid** for main content areas, with a max-width of 1440px for dashboard views to prevent excessive line lengths.

- **The Density Toggle:** Use an 8px base grid. For data tables and sidebars, use "Dense" spacing (8px/4px). For landing dashboards and empty states, use "Generous" spacing (24px/32px).
- **Sidebars:** Fixed at 240px (expanded) or 64px (collapsed).
- **Breakpoints:**
  - Mobile (< 768px): 1-column, 16px margins.
  - Tablet (768px - 1024px): 6-column, 24px margins.
  - Desktop (> 1024px): 12-column, 32px margins.

## Elevation & Depth

This design system avoids heavy shadows, opting for **Flat Stratification** and **High-Precision Outlines**.

- **Level 0 (Base):** Background color (#f8fafc).
- **Level 1 (Cards/Content):** White surface with a 1px solid border (#e2e8f0). No shadow or an extremely faint 2px blur with 2% opacity.
- **Level 2 (Dropdowns/Modals):** White surface with a 1px border (#cbd5e1) and a medium-range "Software Shadow" (0 4px 6px -1px rgb(0 0 0 / 0.1)).
- **Interactive States:** Hover states should be indicated by a subtle background color shift (e.g., Slate-50 to Slate-100) rather than a change in elevation.

## Shapes

The shape language is "Soft-Square." It balances the friendliness of rounded corners with the space efficiency of sharp corners.

- **Standard Radius:** 6px (0.375rem) for buttons, inputs, and cards.
- **Small Radius:** 4px (0.25rem) for tags and inner elements.
- **Large Radius:** 8px (0.5rem) for large modal containers.
- **Full Radius:** Only used for status badges (pills) and profile avatars.

## Components

### Buttons

- **Primary:** Emerald-500 background, White text. Sharp 6px corners.
- **Secondary:** White background, Slate-200 border, Slate-900 text.
- **Ghost:** No border or background, Slate-600 text. Becomes Slate-100 on hover.

### Tables

- **Header:** Light Slate background (#f1f5f9), SemiBold Slate-900 text, 12px font size.
- **Cells:** 13px Inter or JetBrains Mono. 1px horizontal-only borders (#f1f5f9).
- **Row Hover:** Very subtle Slate-50 highlight.

### Status Badges

- **Style:** Pill-shaped.
- **Colors:** Use a 10% opacity background of the semantic color with 100% opacity text of the same color (e.g., Light Emerald bg with Dark Emerald text).

### Sidebars

- **Theme:** Dark (#0f172a) for primary navigation to create clear visual separation.
- **Active State:** A 2px Emerald vertical line on the left edge with a subtle Slate-800 background highlight.

### Metrics & Sparklines

- **Value:** Headline-md, Slate-900.
- **Sparkline:** 2px stroke width, Emerald color, no fill or a very faint gradient fill.
- **Label:** Label-md, Slate-500, placed above the value.

### Tabs

- **Underline Style:** Used for primary page navigation. 2px Emerald underline for the active state.
- **Pill-Toggle:** Used for view switching (e.g., Chart vs. Table). Slate-100 background with a white "floating" card for the active state.
