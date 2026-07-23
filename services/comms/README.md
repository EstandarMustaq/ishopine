# Comms (owned — Fase 22)

Porta **4114**. Com `COMMS_OWNED≠0` (default) trata notificações, conversas
e disputas.

O Nest **outbox** pode continuar a criar notificações in-process
(`NotificationsService.create`).

## Rotas owned

| Prefixo | Auth |
|---|---|
| `/api/notifications/*` | JWT |
| `/api/conversations/*` | JWT (buyer / seller shop) |
| `/api/disputes/*` | JWT; resolve = staff |

```bash
COMMS_OWNED=1
COMMS_URL=http://127.0.0.1:4114
pnpm --filter @ishopine/comms dev
```
