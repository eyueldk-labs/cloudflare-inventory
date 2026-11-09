---
name: Inventory
description: A calm, dark, data-dense workspace for small makers to track stock, production and sales.
colors:
  background: "oklch(0.152 0.017 295.7)"
  sidebar: "oklch(0.170 0.017 296)"
  card: "oklch(0.200 0.022 296.9)"
  muted: "oklch(0.246 0.027 297.5)"
  border: "oklch(0.280 0.030 295.9)"
  foreground: "oklch(0.971 0.009 299.2)"
  muted-foreground: "oklch(0.80 0.032 302.3)"
  primary: "oklch(0.81 0.11 294.7)"
  primary-foreground: "oklch(0.12 0.02 295.7)"
  destructive: "oklch(0.711 0.166 22.2)"
  destructive-fill: "oklch(0.42 0.16 22)"
  severity-error: "oklch(0.78 0.14 25)"
  severity-warning: "oklch(0.90 0.12 85)"
  severity-info: "oklch(0.82 0.07 250)"
  severity-success: "oklch(0.84 0.12 150)"
typography:
  display:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.55
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
  caption:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: "0.3rem"
  md: "0.4rem"
  lg: "0.5rem"
  xl: "0.7rem"
  pill: "1.3rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.destructive-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "44px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  nav-item-active:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: "44px"
---

# Design System: Inventory

## Overview

**Creative North Star: "Inventory"**

The name is the brief: a plain, honest tool for counting what a business has, makes and sells. Everything is in service of exact numbers read quickly, on a phone on the production floor or on a desktop at the end of the day. The interface is one dark theme, Violet Hour: deep violet-black surfaces, near-white text, and a single soft violet accent that marks what you can act on.

Density is deliberate. Lists are tables with tight rows, right-aligned tabular figures, and a pinned first column, because the job is comparing amounts. Work happens in drawers that slide over the list (from the right on desktop, from the bottom on phones), so the user never loses their place. Surfaces are flat and separated by tone and hairline rings, not shadows.

Components are refined and restrained: thin borders, modest radii, one accent, and no decoration that does not carry meaning. Status is the one place colour speaks loudly, and it always speaks with an icon and words.

**Key Characteristics:**
- One dark theme only; no light mode or theme picker.
- One violet accent for primary actions, active navigation, focus and the chart line.
- Flat, tonal layering: background → sidebar → card → muted, with hairline rings.
- Tabular, right-aligned numbers everywhere amounts appear.
- Edit-first drawers over lists; the list stays visible behind.
- Touch-sized controls (44 px) that compact to 32 px on a fine pointer at desktop widths.

## Colors

A near-monochrome violet-black ramp with one luminous lavender accent and four quiet severity hues.

### Primary
- **Lavender Signal** (oklch(0.81 0.11 294.7)): primary buttons, the active nav item's text, focus rings, the selected toggle, the sales chart line, and text selection (35% mix). Paired with **Ink Violet** (oklch(0.12 0.02 295.7)) as the text colour on top of it, chosen to clear 4.5:1.

### Neutral
- **Night Violet** (oklch(0.152 0.017 295.7)): the page background.
- **Deep Sidebar** (oklch(0.170 0.017 296)): the navigation sidebar, one step lifted from the page.
- **Panel Violet** (oklch(0.200 0.022 296.9)): cards, popovers, drawers and menus.
- **Muted Violet** (oklch(0.246 0.027 297.5)): secondary and muted fills, hover backgrounds, the active nav item's fill, the empty part of stock bars.
- **Hairline Violet** (oklch(0.280 0.030 295.9)): borders, dividers, input strokes, chart gridlines.
- **Moonlight** (oklch(0.971 0.009 299.2)): primary text.
- **Lilac Grey** (oklch(0.80 0.032 302.3)): secondary text, labels, captions, axis labels; lightened so it keeps 4.5:1 inside drawers.

### Severity
- **Signal Red** (oklch(0.78 0.14 25)): blocking errors: not enough stock, invalid fields, out of stock.
- **Amber Caution** (oklch(0.90 0.12 85)): warnings: low stock, cautions.
- **Calm Blue** (oklch(0.82 0.07 250)): information and neutral notes, including the Void badge.
- **Fresh Green** (oklch(0.84 0.12 150)): success and a healthy stock level.
- **Destructive Rose** (oklch(0.711 0.166 22.2)) for destructive text and invalid borders; **Deep Brick** (oklch(0.42 0.16 22)) as the fill of destructive buttons with white text.

### Named Rules
**The One Accent Rule.** Lavender Signal is the only accent. It marks what you can act on or where you are; it is never decoration.

**The Never Colour Alone Rule.** Every severity colour appears with its icon (octagon for error, triangle for warning, info circle, check circle) and with text.

## Typography

**Display Font:** Geist Variable (with sans-serif)
**Body Font:** Inter Variable (with sans-serif)

**Character:** Geist gives headings a tight, engineered voice; Inter carries dense data and form labels with excellent legibility at small sizes. Numbers use tabular figures so columns line up.

### Hierarchy
- **Display** (600, 1.875rem, 1.2, tracking -0.025em): the big figures on Overview stat cards (1.5rem on phones). Tabular figures.
- **Headline** (600, 1.5rem, 1.33, tracking -0.025em): the one page title per screen (h1).
- **Title** (500, 1.125rem, 1.55): section headings within a page, such as "Daily sales" or "Recent sales".
- **Body** (400, 0.875rem, 1.43): table cells, drawer content, descriptions. Inputs use 1rem on phones to avoid zoom, 0.875rem from 768 px up.
- **Label** (500, 0.875rem): form labels (always above the field) and button text.
- **Caption** (400, 0.75rem, 1.33): codes under names (MAT00001), field notes, helper text, history metadata, badges.

### Named Rules
**The Tabular Numbers Rule.** Every amount, price, code count and total uses tabular figures and aligns right in tables.

**The Label On Top Rule.** Labels sit above their input, including switches and selects.

## Layout

- **Shell:** a fixed left sidebar (navigation, organization switcher, alerts bell, account) beside a content column. Under 768 px the sidebar becomes an off-canvas sheet, opened from a top bar that also holds the switcher.
- **Content:** padding 16 px on phones and 32 px from 768 px; sections stacked with a 32 px gap. Pages are full-width; tables fill the content column.
- **Page header:** title left, primary actions right. On phones the actions stack full width under the title, so labels are never shortened.
- **Tables:** one primary table per page with search, filters, sort, pagination and a row "⋯" menu. The first column (name plus code) is pinned on narrow screens; the table scrolls sideways under it.
- **Drawers:** right-side sheet up to 448 px wide (672 px for wide forms such as Record sale and New product) on desktop; a bottom drawer up to 92% of the viewport height on phones. Header, scrolling body, pinned footer with Cancel and Save, and an optional summary line.
- **Forms:** fields stacked with a 20 px gap; label-to-input gap 8 px; related short fields share two columns from 640 px.
- **Breakpoints:** 640 px (two-column fields, header actions inline), 768 px (persistent sidebar, desktop drawer, compact controls), 1280 px (three stat cards per row).

## Elevation & Depth

The system is flat. Depth comes from tonal steps (Night Violet page, Deep Sidebar, Panel Violet cards and drawers, Muted Violet fills) and 1 px hairline rings (foreground at 10% on cards, Hairline Violet elsewhere). Shadows appear only on floating layers that sit above the page: drawers, popovers, menus and tooltips. The one structural shadow is the edge shadow on a pinned table column once the table scrolls.

### Shadow Vocabulary
- **Floating layer** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): drawers and the dropdown menu.
- **Floating small** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): popovers such as the organization switcher.
- **Pinned column edge** (`box-shadow: inset -1px 0 0 var(--border), 6px 0 8px -6px oklch(0 0 0 / 0.6)`): the pinned first table column when scrolled sideways.

### Named Rules
**The Flat-By-Default Rule.** Surfaces at rest have no shadow. Lift comes from tone; only overlays float.

## Shapes

Gently curved, never pill-shaped except badges. Controls (buttons, inputs, selects, toggles) use an 8 px radius (`lg`), cards and table frames 11 px (`xl`), small icon buttons and menu items 6 px (`md`), and badges are fully rounded pills. Borders are 1 px hairlines. Organization marks are 32 px rounded squares with a white line icon on one of ten muted colours.

## Components

### Buttons
Quiet and exact: flat fills, no gradients, no shadows.
- **Shape:** gently curved (0.5rem).
- **Primary:** Lavender Signal fill with Ink Violet text; 44 px tall on touch and phones, 32 px on a fine pointer from 768 px; 16 px horizontal padding (10 px compact). Hover lowers the fill to 80%.
- **Outline:** page-colour fill with a hairline border; hover fills Muted Violet. Used for secondary header actions such as "Stock input".
- **Ghost:** no fill; hover fills Muted Violet at 50%. Used for icon buttons and row menus.
- **Destructive:** Deep Brick fill with white text, only inside confirmations (Void, Archive, Discard, Remove).
- **Focus:** a 3 px ring of Lavender Signal at 50%, visible on the first frame. **Pressed:** moves down 1 px. **Disabled:** 50% opacity.

### Inputs / Fields
- **Style:** Muted Violet at 30% on Night Violet, hairline Hairline Violet stroke, 0.5rem radius, 44 px tall (32 px compact). Units sit inside the field on the right ("kg", "pcs", "ETB").
- **Focus:** the stroke turns Lavender Signal with a 3 px ring at 50%.
- **Error:** Destructive Rose stroke and ring at 20%, with the message below the field (error icon plus text).
- **Notes:** helper notes sit under the field in caption size, such as "0.0003 kg = 0.3 g" or "Available 80 pcs".

### Cards / Containers
- **Corner Style:** 0.7rem.
- **Background:** Panel Violet with a 1 px ring of foreground at 10%.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** 16 px (12 px for small cards).

### Tables
- **Header:** body-size medium text with sort arrows; numeric columns right-aligned.
- **Rows:** whole-row hover in Lavender Signal mixed 20% into the background, painted on every cell including the pinned one. The name cell is the row link; the last column hugs its content at the right edge.
- **Row menu:** a ghost "⋯" icon button opening a short menu ordered by importance.
- **Phone:** the same table with the pinned first column and sideways scroll.

### Badges
- **Style:** pill, 20 px tall, caption-size medium text. Severity badges use the severity colour at 15% fill with the full colour for icon and text.

### Navigation
- **Sidebar:** Deep Sidebar background. Items are 44 px rows (32 px compact) with a 16 px icon and label. The active item has a Muted Violet fill, Lavender Signal text and `aria-current="page"`. Settings and the account menu sit in the footer.
- **Mobile:** off-canvas sheet opened from a top bar; choosing an item closes it.

### Stock Level Bar
The signature component. A 10 px rounded track in Muted Violet with a fill in Fresh Green (fine), Amber Caution (at or below the low level) or Signal Red (zero). A 2 px marker shows the low level at the midpoint, and a status icon follows the bar. Exact figures appear in a tooltip and the accessible name, never as visible text beside the bar. Items without a low level show an em dash.

### Severity Message
Inline feedback under fields and in drawer summaries: a 16 px icon and text in the severity colour, 0.875rem (0.75rem under fields).

### Drawer
The edit-first work surface: it opens ready to edit, Save stays off until something changes, and closing a changed form asks "Discard changes?". A pinned footer holds a summary on the left (for example "Sell 8 items, 3,600.00 ETB") and Cancel and Save on the right.

## Do's and Don'ts

### Do:
- **Do** use Lavender Signal (oklch(0.81 0.11 294.7)) only for primary actions, the active nav item, focus and selection.
- **Do** pair every severity colour with its icon and words (octagon error, triangle warning, info, check).
- **Do** right-align amounts with tabular figures and put units inside inputs ("kg", "pcs", "ETB").
- **Do** keep controls 44 px tall on touch and phones; compact to 32 px only on a fine pointer from 768 px.
- **Do** open add and edit work in a drawer over the list, with Save in a pinned footer.
- **Do** put labels above fields and feedback below them.
- **Do** keep one primary table per page, with the name and code pinned in the first column.

### Don't:
- **Don't** add a light theme or a theme picker; Violet Hour is the only theme.
- **Don't** use shadows on resting surfaces; separate them with tone and hairline rings.
- **Don't** show status with colour alone, or put the stock number as visible text beside the stock bar.
- **Don't** add a second accent colour or use the accent for decoration.
- **Don't** use Deep Brick destructive fills outside confirmation steps.
