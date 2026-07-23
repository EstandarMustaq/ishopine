# Services — estado em produção

## Resposta directa

**Em Vercel (https://ishopine-api.vercel.app) os microserviços em `services/` NÃO estão a correr como processos separados.**

O que está live é a **API Nest** (`apps/api`) — um shell/monólito que ainda serve rotas de catálogo/produtos (ex. `GET /api/products` → 200). Health dos stranglers (`/api/auth/health`, `/api/catalog/health`, …) devolve **404** em produção.

## O que `services/` é

Pasta do monorepo com stranglers locais (ports 4100–4120): identity, catalog, orders, payments, wallet, media, logistics, etc. Funcionam com:

```bash
pnpm dev:identity   # :4107
pnpm dev:catalog    # :4110
# … + gateway / STRANGLER_ROUTING=1
```

Ver `services/README.md`.

## Produção hoje

| Camada | Deploy | Estado |
|---|---|---|
| Marketplace | Vercel `ishopine` → `apps/marketplace-web` | Live |
| API Nest | Vercel `ishopine-api` → `apps/api` | Live (produtos/auth via Nest) |
| Stranglers `services/*` | **Não deployados** no Vercel | Só local / futuro host |
| PaySuite | `PAYSUITE_ENABLED=0` | Desactivado até cota |

## Próximo passo (quando quiser)

Deploy dos stranglers (Fly/Railway/containers) + gateway à frente, com `*_OWNED=1` e URLs no env. Até lá, o marketplace usa a API Nest.
