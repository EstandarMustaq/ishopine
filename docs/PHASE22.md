# Fase 22 — Comms extract (notifications / messages / disputes)

## Objectivo

Extrair as superfícies Nest de **notificações**, **conversas/mensagens** e
**disputas** para `services/comms` (`COMMS_OWNED`) com parity.
Sem teatro de Correios/DHL nem multi-PoP CDN.

## Entregue

### Comms owned (`COMMS_OWNED≠0`, :4114)
- **Notifications:** list, mark read, mark-all-read
- **Conversations:** list/start, list/send messages (+ notify recipient)
- **Disputes:** create (buyer), list (buyer/seller/staff), resolve (staff)
- Creates de notificação a partir de messages/disputes no serviço owned

### Nest
- Outbox `NotificationsService.create` permanece in-process
  (ex. `billing.payment.paid`)

### Gateway
- `/api/notifications`, `/api/conversations`, `/api/disputes` → `COMMS_URL`

## Env

```bash
COMMS_OWNED=1
COMMS_URL=http://127.0.0.1:4114
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Clientes HTTP Correios / DHL → **Fase 23** ([PHASE23.md](./PHASE23.md)) (DHL fail-closed; Correios ainda indisponível)
- Multi-região CDN / PoPs → **Fase 23** (Cloudinary edge + `MEDIA_CDN_HOST`; sem PoP fictícios)
- Coupons / inventory / reviews → **Fase 24** ([PHASE24.md](./PHASE24.md))
- Remover creates Nest do outbox
