# Fase 38 — Nest HTTP retirement (media / developers / logistics)

## Objectivo

Retirar HTTP Nest já owned por media / developers / logistics —
**sem** inventar Correios HTTP (OpenAPI ausente).

## Entregue

### Deleted Nest HTTP
| Nest | Strangler | Notes |
|---|---|---|
| `uploads/*` (module) | media `:4105` | full delete; static `/uploads` serve kept in `create-app` |
| `developers.controller` + public + `ApiKeyGuard` | developers `:4106` | `DevelopersService` kept for Outbox |
| `feature-flags.controller` | developers `:4106` | `FeatureFlagsService` kept for boot seed |
| `logistics.controller` | logistics `:4112` | `LogisticsService` kept for Orders fallthrough |

### Kept on Nest
- `DevelopersService` — OutboxDispatcher webhooks
- `FeatureFlagsService` — `OnModuleInit` default flag upsert
- `LogisticsService` — Nest OrdersService quote/label fallthrough
- Auth / orders / cart HTTP remnant
- Finance services (Phase 37 controllers — separate PR if still open)

### Production path
```bash
STRANGLER_ROUTING=1
MEDIA_URL=http://127.0.0.1:4105
DEVELOPERS_URL=http://127.0.0.1:4106
LOGISTICS_URL=http://127.0.0.1:4112
```

Sem essas URLs, rotas caem no monólito e passam a 404.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.
Logistics Nest carriers registry unchanged (DHL live path only when configured).

## Fora de âmbito
- Cliente HTTP Correios
- Remover Nest Auth / orders / cart HTTP
- Remover DevelopersService / LogisticsService / FeatureFlagsService
- Remover Nest finance controllers → **Fase 37** ([PHASE37.md](./PHASE37.md) / PR #53)
