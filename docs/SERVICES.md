# Services — ownership & production

## Policy (non-negotiable)

1. Every domain service in `services/` is the **exclusive owner** of its routes.
2. Nest (`apps/api`) is a **shell only** (legacy cron bridge optional) — **no domain logic**.
3. No inactive, duplicate, or “preparatory” services: if a package exists, it is wired into the production edge.
4. Strangler cutover means: service owns the domain; monolith **stops** serving it.

## Production path — composition edge

On Vercel, long-running per-service processes are not available. Official production entry:

| Layer | Role |
|---|---|
| **`apps/platform-api` / `apps/api` composition** | Composition edge — routes HTTP → `handleOwned*` from each service |
| **`services/*`** | Exclusive domain implementations |
| **`apps/gateway`** | Local/container mesh when `STRANGLER_ROUTING=1` + `*_URL` |

`GET /api/health` (composition) → `{ mode: "composition", ownership: "services-exclusive", domains: [...] }`

**Cutover status:** composition is implemented and smoke-tested locally. Production `ishopine-api` remains on the last stable Nest monolith deploy until the composition preview is verified end-to-end (Prisma binaries on Vercel). Do **not** promote a broken composition build — prefer rollback over mixed ownership.

### Promote checklist

1. Preview deploy of composition returns health with `mode: "composition"`
2. `GET /api/products` 200 and `GET /api/auth/me` 401
3. Switch `apps/api/api/index.js` to `require("../composition/api.js")`
4. Promote; keep previous deployment as instant rollback

## Local multi-process (optional)

```bash
pnpm dev:gateway      # :8080  STRANGLER_ROUTING=1
pnpm dev:identity     # :4107
pnpm dev:catalog      # :4110
# …
```

## Domains owned

identity · accounts · marketplace · catalog · reviews · media · orders · payments · wallet · billing · developers · logistics · accounting · comms · coupons · inventory · affiliates · platform-settings · platform-ops · platform-security

`commerce-orchestrator` remains a saga composer (HTTP to orders+payments). In composition mode it returns 501 pointing clients to orders/billing until the orchestrator process is hosted separately.

## PaySuite / Correios

- PaySuite: `PAYSUITE_ENABLED=0` until merchant quota
- Correios: gated until real OpenAPI contract
