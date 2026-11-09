# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small makers who buy raw materials and packaging, make products from them, and sell those products. Ethiopia first: the first client is an Ethiopian cosmetics maker, and money is in ETB with Ethiopian calendar dates shown beside Gregorian ones. Global later, so no choice should block other currencies and calendars.

People inside one organization:

- **Owner (instance owner):** the person who installed the app on their own Cloudflare account. Usually not technical. Creates organizations.
- **Admin:** runs an organization. Edits items and prices, corrects mistakes, adjusts counts, manages members and settings.
- **Contributor:** daily work on the floor or in the shop: add inputs, stock inputs, stock products (production runs), record sales.
- **Viewer:** reads only.

The job: always know what is on hand, what it cost, what was made and sold, and who did what, with no stock below zero and no lost history.

## Product Purpose

A private, invite-only inventory system that each business runs on its own free Cloudflare account. It tracks inputs (materials in kg, packaging in pieces), products with their composition per unit, production runs, multi-line sales with invoices, alerts, and a full audit trail. Success means correct on-hand amounts, true unit costs and profit, and a complete history of every change, for a business that cannot afford or does not want a hosted SaaS.

## Positioning

The business owns the whole thing: the app and its data live in their own Cloudflare account, on the free plan, installed and updated with one link and no technical skill. No subscription, no vendor holding the data. Stock math is strict (no negative stock, weighted-average cost from purchases, composition versions frozen per production run, sale prices and costs snapshotted at sale time), which spreadsheets and generic stock apps do not enforce.

## Operating Context

- Used on phones and desktops, often on the production floor or at the point of sale.
- Install and update through the one-click installer (installer link plus a Cloudflare token); a GitHub-based Deploy button is the alternative. The first visitor to a fresh install creates the owner account.
- No email service: invites are one-time links (7 days) that an admin copies and sends through any chat app.
- Invoices are printed or saved as PDF from the browser.
- One install can hold several organizations; each organization's data is separate.

## Capabilities and Constraints

- **Entities:** Organization, Input (Material in kg up to 6 decimals, Packaging in whole pieces), Product (composition per unit, additional cost per unit, named prices from shared price names, low level, opening stock), Stock product (production run), Sale (one invoice, many lines), Alert, Member, Invite.
- **Codes:** `MAT#####`, `PAK#####`, `PRO#####`, `SAL#####`, per organization, at least 5 digits, never reused.
- **Rules:** no negative stock; unit cost comes only from purchases (weighted average) and is never typed; composition is versioned and each run keeps its version; each sale line snapshots name, price and unit cost; money stored as whole santim; kg stored as milligrams.
- **History:** append-only. Mistakes use Correct (void with a reason, then a prefilled re-entry), Adjust count (after a physical count), Void (sales) and Archive (items). Every edit is logged.
- **Technical:** Cloudflare Workers + D1 + Workers Static Assets, Hono, Better Auth, Drizzle, React with TanStack Router and Query, shadcn/ui. Must run within Cloudflare's free plan (requests per day, D1 rows read/written per day, 5 GB storage, 10 ms CPU per request).
- **Open decision:** keeping every record forever may not fit the free plan long term. A retention approach (for example archiving or summarizing old history) is undecided; until then, nothing is deleted.
- **Open decision:** currency and calendar are fixed to ETB and Gregorian with an Ethiopian tooltip today; making them per-organization settings is planned for the global phase, not decided in detail.
- **Out of scope for now:** public sign-up, e-commerce, customers directory, email delivery, tax and accounting exports, native mobile apps, Amharic UI.

## Brand Commitments

- **Name:** undecided. "Inventory" is the working name in the app and README.
- **Voice:** short, active, plain sentences; one word for one meaning (ASD-STE100 style). Use the product words: Input, Material, Packaging, Product, Composition, Stock product, Record sale, Correct, Void, Archive, Adjust count, On hand, Organization. Do not use synonyms such as Ingredient, Recipe, SKU, Produce, Delete, or Book.
- No client names or client branding in the product or repository.

## Evidence on Hand

- The approved clickable mockup and product spec from the original client project (Round 11), which this implementation follows.
- A working install on the owner's account and the one-click installer.
- No testimonials, customer logos, usage numbers, or press exist. Do not invent any.

## Product Principles

1. **Simplicity first.** A person uses it without a tutorial. A feature without clear day-one value waits.
2. **Never delete the past.** History is append-only; fix mistakes by correcting, voiding, adjusting, or archiving, all with a reason.
3. **Free plan friendly.** Every feature must fit Cloudflare's free plan: few requests, few database reads and writes, small CPU per request.
4. **Non-technical owners.** Installing, updating, inviting, and daily use must never need a terminal, GitHub, or configuration files.
5. **Ethiopia first, global later.** Serve Ethiopian makers well today without choices that block other currencies, calendars, or languages.

## Accessibility & Inclusion

- Works on phones and desktops; primary controls at least 44 px on touch.
- Severity is always colour plus icon plus text, never colour alone; contrast meets WCAG AA.
- Plain language for non-technical users.
