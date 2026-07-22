# Fase 1 — apps por perfil + tenant no seller

## Objectivo

Separar superfícies por perfil e propagar isolamento por tenant:

| App | Porta (dev) | Quem |
|---|---|---|
| `apps/web` | 3000 | Marketplace (compradores) |
| `apps/seller` | 3001 | Vendedores (PARTICULAR + STORE) |
| `apps/backoffice` | 3002 | Staff iShopine (ops) |
| `apps/affiliate` | 3003 | Afiliados |

## Entregue

1. **Apps Next.js** seller / backoffice / affiliate (clonados do web, slimmed).
2. **Seller:** `TenantSwitcher` + `x-tenant-id` em todas as requests API.
3. **Marketplace:** `/painel/*` redireciona; login faz handoff `?token=` para a app certa.
4. **API:** `TenantGuard` + `RequireTenantTypes` em catalog (CRUD produtos), orders (selling/status), inventory, shops (mine/update). Staff pode omitir o header.
5. **Scripts:** `dev:seller`, `dev:backoffice`, `dev:affiliate`.

## Env

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_MARKETPLACE_URL=http://localhost:3000
NEXT_PUBLIC_SELLER_URL=http://localhost:3001
NEXT_PUBLIC_BACKOFFICE_URL=http://localhost:3002
NEXT_PUBLIC_AFFILIATE_URL=http://localhost:3003
```

## Auth cross-app

Origens diferentes (portas) não partilham `localStorage`. Fluxo Fase 1:

1. Login no marketplace (`/entrar`).
2. Redirect absoluto para seller/backoffice/affiliate com `?token=JWT`.
3. AuthGate consome o token, grava em `ishopine-auth`, limpa a query.

## Próximo (Fase 2+)

- Cookie SSO em domínio partilhado (`.ishopine.co.mz`)
- Filtrar pedidos/produtos pelo `request.tenant` no serviço (não só guard)
- Extrair primeiros microserviços via gateway strangler
