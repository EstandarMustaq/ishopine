# Fase 16 — Accounts extract (accounts owned)

## Objectivo

Extrair o domínio **Account / Tenant** (`/api/accounts`) para
`services/accounts` (`ACCOUNTS_OWNED`) com parity Nest — sem teatro de
Correios/DHL nem multi-PoP CDN.

## Entregue

### Accounts owned (`ACCOUNTS_OWNED≠0`, :4109)
- `GET /api/accounts/me` — account + tenants + `platformStaffRole`
- `POST /api/accounts/tenants/particular` — 0..1 PARTICULAR por account
- `POST /api/accounts/tenants/store` — N STORE (opcional `shopId`)
- `GET /api/accounts/tenants/active` — resolve `x-tenant-id` (ou `null`)

### Nest
- `AccountsService` + `TenantGuard` permanecem in-process (authz de catalog,
  wallet, billing, etc.) — extract HTTP do edge seller/SSO, não DI remota

### Gateway
- Prefixo `/api/accounts` → `ACCOUNTS_URL` (`STRANGLER_ROUTING=1`)

## Env

```bash
ACCOUNTS_OWNED=1
ACCOUNTS_URL=http://127.0.0.1:4109
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- Multi-região CDN / PoPs
- Remotizar `TenantGuard` para todos os serviços
- Catalog / marketplace extract
