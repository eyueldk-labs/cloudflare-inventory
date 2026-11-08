# Inventory

A private inventory app for small makers: inputs (materials and packaging), products with compositions, production runs, sales with invoices, alerts, and a full audit trail. It runs on your own Cloudflare account. The free plan is enough.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/eyueldk-labs/cloudflare-inventory)

## Get started

1. Click **Deploy to Cloudflare** and accept the defaults. A D1 database is created for you.
2. Open your app's URL. The first person to open it creates the owner account and the first organization.
3. Invite everyone else from **Users**: make a link and send it in any chat app.

Open the app right after it deploys, so you are the one who creates the owner account.

## Updates

Your copy updates itself every Monday from this repository, and Cloudflare redeploys it. To update now, open your repository's **Actions** tab, choose **Update from upstream**, and select **Run workflow**. Your `wrangler.jsonc` is never changed.

## Develop

```bash
npm install
npm run dev
```

Built with Cloudflare Workers, D1, Hono, Better Auth, Drizzle, React, TanStack Router and Query, and shadcn/ui.
