# Inventory

A private inventory app for small makers: inputs (materials and packaging), products with compositions, production runs, sales with invoices, alerts, and a full audit trail. It runs on your own Cloudflare account. The free plan is enough.

**[Install on Cloudflare →](https://cloudflare-installer.eyueldk.workers.dev/?repo=eyueldk-labs/cloudflare-inventory)**

## Get started

1. Open the **Install on Cloudflare** link above. You only need a free Cloudflare account; no GitHub account.
2. Select **Create a token**, create it on the Cloudflare page that opens, and paste it back. Then select **Install**.
3. Open your app's address. The first person to open it creates the owner account and the first organization.
4. Invite everyone else from **Users**: make a link and send it in any chat app.

Open the app right after it installs, so you are the one who creates the owner account.

## Updates

Open the same install link and select **Update**. Your data stays where it is.

## Other ways to install

- **With GitHub:** [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/eyueldk-labs/cloudflare-inventory) copies this repository into your GitHub account and deploys it. That copy updates itself every Monday (or on demand: **Actions** → **Update from upstream** → **Run workflow**).
- **Prebuilt bundle:** every release has a ready-to-deploy `cloudflare-app.tar.gz` (Worker, static files, and `manifest.json`).

## Develop

```bash
npm install
npm run dev
```

Built with Cloudflare Workers, D1, Hono, Better Auth, Drizzle, React, TanStack Router and Query, and shadcn/ui.
