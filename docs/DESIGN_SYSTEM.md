# Tokenly Design System

## Design intent

Tokenly should feel calm, quick, and trustworthy at a busy floorball event. The interface uses soft event colour, generous space, and strong information hierarchy. Floorball references are subtle supporting details rather than decorative themes.

The customer wallet balance is the strongest element in the customer application. Operational dashboards prioritise scanability and state, not decoration.

## Foundation tokens

`src/app/globals.css` is the implemented source of truth. It defines `--tokenly-*` primitives and maps them to semantic Tailwind theme tokens. Use the semantic names in components (for example, `bg-canvas`, `bg-surface`, `text-ink`, and `shadow-soft`) instead of hard-coded colour or shadow values.

### Colour

| Semantic theme token        | Primitive                     | Value     | Use                                              |
| --------------------------- | ----------------------------- | --------- | ------------------------------------------------ |
| `--color-canvas`            | `--tokenly-canvas`            | `#fffaf6` | Primary warm-white page background               |
| `--color-canvas-soft`       | `--tokenly-canvas-soft`       | `#f5f3ef` | Quiet grouped-page or inset background           |
| `--color-surface`           | `--tokenly-surface`           | `#ffffff` | Cards, sheets, and raised panels                 |
| `--color-ink`               | `--tokenly-ink`               | `#17243b` | Primary text and high-emphasis icons             |
| `--color-ink-soft`          | `--tokenly-ink-soft`          | `#263751` | Softer headings and secondary high-emphasis text |
| `--color-ink-muted`         | `--tokenly-ink-muted`         | `#596579` | Supporting text and metadata                     |
| `--color-brand-blue`        | `--tokenly-brand-blue`        | `#a8d9f1` | Blue accent and selected/decorative surfaces     |
| `--color-brand-blue-soft`   | `--tokenly-brand-blue-soft`   | `#e0f3fc` | Low-emphasis blue panels                         |
| `--color-brand-blue-strong` | `--tokenly-brand-blue-strong` | `#286b91` | Blue actions, links, and focus emphasis          |
| `--color-brand-pink`        | `--tokenly-brand-pink`        | `#efafc6` | Pink accent and decorative surfaces              |
| `--color-brand-pink-soft`   | `--tokenly-brand-pink-soft`   | `#fbe5ed` | Low-emphasis pink panels                         |
| `--color-brand-pink-strong` | `--tokenly-brand-pink-strong` | `#9e486b` | Strong pink emphasis on light surfaces           |
| `--color-brand-mint`        | `--tokenly-brand-mint`        | `#b9ddce` | Mint accent and calm positive surfaces           |
| `--color-brand-mint-soft`   | `--tokenly-brand-mint-soft`   | `#e3f2ec` | Low-emphasis mint panels                         |
| `--color-brand-mint-strong` | `--tokenly-brand-mint-strong` | `#35745e` | Strong mint emphasis on light surfaces           |
| `--color-surface-blue`      | `--tokenly-brand-blue-soft`   | `#e0f3fc` | Semantic blue-tinted surface alias               |
| `--color-surface-pink`      | `--tokenly-brand-pink-soft`   | `#fbe5ed` | Semantic pink-tinted surface alias               |
| `--color-blue-300`          | `--tokenly-brand-blue`        | `#a8d9f1` | Numeric blue accent alias                        |
| `--color-blue-600`          | `--tokenly-brand-blue-strong` | `#286b91` | Numeric strong-blue alias                        |
| `--color-pink-300`          | `--tokenly-brand-pink`        | `#efafc6` | Numeric pink accent alias                        |
| `--color-pink-600`          | `--tokenly-brand-pink-strong` | `#9e486b` | Numeric strong-pink alias                        |
| `--color-muted`             | `--tokenly-ink-muted`         | `#596579` | Concise muted-text alias                         |
| `--color-focus`             | `--tokenly-brand-blue-strong` | `#286b91` | Standard focus-ring alias                        |
| `--color-danger`            | `--tokenly-danger`            | `#b84a5b` | Destructive actions and error emphasis           |
| `--color-warning`           | `--tokenly-warning`           | `#9b6519` | Manual review and warning emphasis               |
| `--color-success`           | `--tokenly-success`           | `#34705a` | Confirmed and safe states                        |

Tailwind examples use the part after `--color-`: `bg-canvas`, `bg-canvas-soft`, `bg-surface`, `bg-surface-blue`, `text-ink`, `text-ink-muted`, `text-muted`, `bg-brand-blue-soft`, `text-blue-600`, `ring-focus`, and `text-danger`. Prefer the descriptive `brand-*` tokens for new brand-specific work; the surface, numeric-colour, muted, and focus aliases support existing semantic component usage. Use `focus` for the standard focus ring unless a component needs the danger state.

Do not rely on pastel background colour alone to communicate status. Text/icon contrast must meet WCAG AA.

### Typography

Use the implemented `--font-sans` / `font-sans` stack: Inter, `ui-rounded`, `"SF Pro Rounded"`, `"Segoe UI"`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, then `sans-serif`. Keep font loading local or framework-managed; no runtime API key is required.

| Role            | Mobile starting point       | Notes                                |
| --------------- | --------------------------- | ------------------------------------ |
| Display balance | `clamp(3rem, 12vw, 5.5rem)` | Bold tabular numerals                |
| Page title      | `2rem / 1.1`                | Compact, confident                   |
| Section title   | `1.25rem / 1.3`             | Clear hierarchy                      |
| Body            | `1rem / 1.55`               | Default readable copy                |
| Small/metadata  | `0.875rem / 1.45`           | Never below 14 px for essential data |

Use tabular numerals for token totals, references where useful, and dashboard figures.

### Space and shape

- Base spacing rhythm: 4 px.
- Common gaps: 8, 12, 16, 24, 32, 48, and 64 px.
- Page content inline padding: 16–20 px mobile, 24–32 px tablet, 32–48 px desktop.
- Use the implemented `--radius-card` / `rounded-card` token (`1.5rem`, 24 px at the default root size) for feature cards.
- Compact controls may use an appropriate smaller Tailwind radius; do not introduce a second card-radius token casually.
- Button/input height: at least 48 px; all interactive targets at least 44 × 44 px.
- Use the implemented semantic shadow tokens:
  - `--shadow-soft` / `shadow-soft`: `0 1px 2px rgb(23 36 59 / 0.04), 0 12px 28px rgb(43 67 93 / 0.08)`.
  - `--shadow-raised` / `shadow-raised`: `0 2px 4px rgb(23 36 59 / 0.08), 0 16px 34px rgb(43 67 93 / 0.14)`.
  - `--shadow-floating` / `shadow-floating`: `0 4px 10px rgb(23 36 59 / 0.08), 0 28px 60px rgb(43 67 93 / 0.16)`.
- Prefer `shadow-soft` for ordinary cards, `shadow-raised` for interactive or foreground panels, and `shadow-floating` for transient overlays. Do not outline every card.
- Dividers: prefer spacing and subtle background changes; use fine lines only when structure needs them.

### Motion

- Use 120–220 ms transitions for hover, expand, and sheet movement.
- Prefer opacity and transform; avoid distracting continuous movement.
- Never delay a transaction result for animation.
- Under `prefers-reduced-motion: reduce`, remove non-essential transform/scroll animation and make onboarding transitions immediate.

## Tokenly event mark

Create an original mark from simple CSS or SVG geometry:

- a rounded token/circle;
- a small offset perforation pattern suggesting a floorball;
- one restrained court-line arc or wallet-layer shape;
- pastel blue/pink surfaces with dark navy definition.

The mark must remain recognizable at 24 px, have a text alternative when meaningful, and not imitate Canva, Figma, a floorball association, or another product’s branding.

## Core components

### Wallet balance card

- Highest contrast/hierarchy on customer home.
- Shows integer token balance and a simple “tokens” label.
- Includes “Scan to pay” as the primary action and a less prominent QR/balance detail action.
- Loading state reserves the final layout; error state does not display a guessed balance.

### Buttons

- Primary: solid accessible blue with white text.
- Secondary: tinted surface with dark text.
- Destructive: danger styling used only on confirmation, refund, reset, or similar risk.
- Loading buttons retain their width, communicate progress, and prevent duplicate submission.
- Disabled styles must remain readable and must not be the sole authorization control.

### Cards and panels

- Use rounded surfaces, soft shadows, and generous padding.
- Layer a tinted section behind groups rather than adding hard borders.
- Interactive cards need hover, active, keyboard focus, and disabled states.

### Forms

- Labels remain visible; placeholders are examples, not labels.
- Validation appears next to the field and a summary is used for complex forms.
- Token/PIN inputs use input modes appropriate for digits.
- PIN fields never echo values into debug output or persist them.
- Review steps use definition lists or grouped summaries, not editable-looking controls.

### Status and feedback

- Use icon, text, and colour together.
- Success receipts have a clear reference and next action.
- Warning panels explicitly describe manual PayNow checks and manual settlement records.
- Empty states are concise and provide one appropriate next action.
- Skeletons use restrained motion and respect reduced-motion settings.

### Dialogs and sheets

- Mobile: bottom sheet or full-screen dialog for basket, PIN, scan, and confirmation when appropriate.
- Desktop: centred dialogs or persistent detail panels.
- Trap focus, label the dialog, support Escape when safe, return focus, and warn before dismissing entered data.

### Navigation

- Customer mobile: compact bottom navigation where it improves reach.
- Operational mobile: role-specific bottom or top navigation with prominent primary action.
- Desktop: persistent side navigation and wider content region.
- Current location is conveyed through more than colour.

## Responsive composition

### Mobile: 390 px reference

- One column, stacked cards, full-width primary actions.
- Sticky primary action when review length could hide it.
- Avoid horizontal tables; use compact record cards or progressive detail.
- Keep critical totals/actions within easy thumb reach.

### Tablet

- Use two-column summaries where content benefits.
- Keep staff scanning/issuance review side by side when space allows.
- Do not introduce desktop-density tables prematurely.

### Desktop: 1280 px reference

- Side navigation with page title/action bar.
- Dashboard metrics in a deliberate grid.
- Persistent filters and tables for administrator records.
- Master/detail panels for transaction tracing.
- Customer storefront may use product grid plus sticky basket summary.

Never stretch the mobile column to fill the desktop viewport.

## Role-specific tone

- Customer: short and warm (“Welcome back, Tokener”, “Enjoy your order”).
- Vendor/staff/admin: concise and operational (“Issuance recorded”, “Manual settlement status”).
- Audit, export, database, and system errors: precise technical language, no playful terms.

## Accessibility checklist

- Meet WCAG AA text and component contrast.
- Preserve a visible 2 px or stronger focus indicator.
- Use semantic landmarks, headings, form labels, tables, and buttons.
- All icon-only controls have accessible names.
- Announce validation and transaction results appropriately.
- Never depend on hover, gesture, or camera access alone.
- Validate keyboard flow and focus restoration.
- Test zoom/reflow, long content, and 390 px layout without horizontal overflow.
- Respect reduced motion and platform font scaling.
