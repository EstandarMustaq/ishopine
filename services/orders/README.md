# orders (strangler)

Porta **4101**. Rotas: `/api/orders/*`, `/api/cart/*`.

## Modo owned (`ORDERS_OWNED≠0`, default)

| Método | Path | Owner |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/cart*` | **owned** |
| GET | `/api/orders/mine`, `/selling`, `/:id` | **owned** |
| PATCH | `/api/orders/:id/status` | **owned** |
| POST | `/api/orders/checkout` | Nest upstream |

## Proxy

`ORDERS_OWNED=0` → tudo para `UPSTREAM_API_URL`.
