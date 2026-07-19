# iShopine — agent notes

- Product: **iShopine** (`ishopine.com`) — marketplace for Mozambique (MZN). Not operated by Nkateko.
- Packages: `@ishopine/api` (NestJS), `@ishopine/web` (Next.js).
- Payments: **PaySuite** only (`apps/api/src/billing/paysuite/` — TS client mirroring hypertech/paysuite-php-sdk). Methods: `mpesa`, `emola`, `credit_card`.
- PaySuite has **no sandbox** — use `PAYSUITE_SIMULATE=true` only for local demos without a token. Production requires `PAYSUITE_TOKEN` + `PAYSUITE_WEBHOOK_SECRET`.
- Webhooks: verify `X-Webhook-Signature` HMAC-SHA256; idempotent via `BillingWebhookEvent.requestId`.
- Demo password: `IShopine@2026` — `admin@ishopine.com`, etc.
- Health: `GET /api/health`.
