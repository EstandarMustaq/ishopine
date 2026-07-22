# commerce-orchestrator

Saga de checkout da plataforma (Fase 3).

```
validate → create_orders → create_payment → done
```

Enquanto a lógica vive no monólito, este serviço **compõe** os endpoints
já existentes (`/api/orders/checkout` + `/api/billing/paysuite/checkout`)
e expõe um único comando:

`POST /api/commerce/checkout`

O gateway encaminha `/api/commerce/*` para aqui quando `ORCHESTRATOR_URL`
está definido (senão cai no monólito, que também expõe o mesmo path).

## Env

```bash
PORT=4100
UPSTREAM_API_URL=http://127.0.0.1:4000
```
