# Fase 5 — Store depth, Media, Feature Flags, Developer Platform

## Objectivo

Aprofundar a **Store Platform**, media com scope por tenant, **feature flags**
ops, e uma **Developer Platform** mínima (API keys + webhooks) — sem extrair
15 microserviços.

## Entregue

### Store depth
- `Shop.policiesText`, `Shop.hoursJson`
- `PATCH /shops/:id` aceita políticas / horários / logo / banner
- Criação de loja auto-liga **Tenant STORE**
- Seller `/loja` — editar perfil + upload logo/banner

### Media
- `MediaAsset` scoped (`accountId`, `tenantId`, `shopId`, `uploadedById`)
- `POST/GET/DELETE /api/uploads` e alias `/api/media`
- Strangler **media** :4105

### Feature flags
- `FeatureFlag` + `FeatureFlagOverride` (`global` / `tenant:` / `plan:`)
- Seed: `developer_platform`, `store_hours_policies`, `media_tenant_scope`
- `GET /feature-flags/evaluate`, backoffice `/feature-flags`

### Developer Platform
- `MerchantApiKey`, `MerchantWebhookEndpoint`, `MerchantWebhookDelivery`
- Seller `/desenvolvedores` — keys + webhook URL
- Public Commerce API: `GET /api/v1/me|products|orders` (Bearer `ish_live_…`)
- Outbox → signed merchant webhooks (`X-iShopine-Signature`)
- Usage `API_CALLS` metered
- Strangler **developers** :4106

## Gateway

```bash
STRANGLER_ROUTING=1 \
  MEDIA_URL=http://127.0.0.1:4105 \
  DEVELOPERS_URL=http://127.0.0.1:4106 \
  …
```

## Fora de âmbito (ainda)
- Cookie SSO domínio partilhado
- Extrair lógica Nest para fora do monólito (proxies only)
- Resize/CDN avançado
