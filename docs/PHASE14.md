# Fase 14 — Affiliate extract (affiliates owned)

## Objectivo

Extrair o domínio de **afiliados** (`/api/affiliate`) para
`services/affiliates` (`AFFILIATES_OWNED`) com parity Nest — links, cliques,
recompensas, approve/pay staff, e conversão idempotente no settle — sem teatro
de Correios/DHL nem multi-PoP CDN.

## Entregue

### Affiliates owned (`AFFILIATES_OWNED≠0`, :4108)
- `GET /summary`, `GET|POST /links`, `GET /rewards`
- `POST /click/:code` (público)
- `PATCH /rewards/:id/approve|pay` — `PLATFORM_ADMIN|OPERATOR` + 2FA
- `POST /internal/register-conversion` — Bearer `INTERNAL_SERVICE_SECRET` \| `CRON_SECRET`
  (idempotente por `orderId` + `linkId`)

### Nest settle remote
- `settlePaidOrders` → `AFFILIATES_URL` quando `AFFILIATES_SETTLE_REMOTE≠0`
- Fallback in-process `AffiliateService` se URL/secret ausentes
- Falha de afiliado **não** reverte confirmação de pagamento (igual wallet)

### Gateway
- Prefixo `/api/affiliate` → `AFFILIATES_URL` (`STRANGLER_ROUTING=1`)

## Env

```bash
AFFILIATES_OWNED=1
AFFILIATES_URL=http://127.0.0.1:4108
AFFILIATES_SETTLE_REMOTE=1
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
INTERNAL_SERVICE_SECRET=...
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- Multi-região CDN / PoPs
- Subscription extract (Fase 15)
- Outbox `affiliate.reward.*` (dispatcher Nest permanece; eventos ainda não emitidos)
