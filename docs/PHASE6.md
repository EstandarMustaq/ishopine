# Fase 6 — Cookie SSO, extracção real (media), logistics stub

## Objectivo

Sessão partilhada por **cookie HttpOnly**, primeira extracção **owned**
(media deixa de ser proxy puro), higiene do strangler partilhado, e
esqueleto de **logistics** (quotes flat/free/pickup) — sem carriers.

## Entregue

### Cookie SSO
- Cookie `ishopine_session` (HttpOnly, `SameSite=Lax`, `Domain=COOKIE_DOMAIN`)
- Login / verify-2fa / Google / logout definem ou limpam o cookie
- `JwtStrategy` aceita **Bearer ou cookie**
- Frontends: `credentials: "include"`; auth-gates tentam sessão por cookie
- Com `NEXT_PUBLIC_COOKIE_SSO=1` / `COOKIE_DOMAIN`, handoff sem `?token=`

### Identity edge
- Serviço **identity** :4107 (proxy `/api/auth`)
- Gateway route `IDENTITY_URL`

### Media owned
- `services/media` com `MEDIA_OWNED≠0` (default): trata `POST/GET` uploads
  localmente (JWT + Prisma + disco)
- `MEDIA_OWNED=0` → proxy puro
- Health reporta `mode: "owned" | "proxy"`

### Strangler partilhado
- `packages/shared` exporta `startStranglerProxy` (+ `mode`, `handleOwned`)
- Serviços wallet/billing/orders/payments/developers/media/identity usam o helper

### Logistics stub
- `POST /api/logistics/quote` — FLAT / FREE / PICKUP a partir de
  `PlatformSettings`
- Tipos `ShippingQuote*` + eventos `shipping.*` em shared
- Carriers / tracking → Fase 7+

## Env

```bash
COOKIE_DOMAIN=.ishopine.com          # prod shared parent
AUTH_COOKIE_NAME=ishopine_session    # optional override
NEXT_PUBLIC_COOKIE_SSO=1
IDENTITY_URL=http://127.0.0.1:4107
MEDIA_OWNED=1
JWT_SECRET=…                         # required by owned media
```

## Fora de âmbito
- Extrair wallet/orders Nest para fora do monólito
- Integrações de transportadoras
- Resize/CDN avançado
