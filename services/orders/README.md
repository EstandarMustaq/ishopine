# orders (strangler)

Fase 3: serviço de borda para `/api/orders/*` e `/api/cart/*`.

Neste passo ainda **proxy** para o monólito (`UPSTREAM_API_URL`).
O gateway encaminha estas rotas para `ORDERS_URL` quando definido.

Próximo: mover handlers Nest do monólito para aqui.
