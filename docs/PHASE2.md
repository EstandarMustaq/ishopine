# Fase 2 — catálogo híbrido + afiliados end-to-end

## Objectivo

1. **Catálogo híbrido:** categorias `GLOBAL` (marketplace) + `STORE` (por loja), produtos scoped ao tenant.
2. **Afiliados E2E:** `?ref=` → clique → checkout → comissão no pagamento.

## Entregue

### Catálogo
- Prisma: `CategoryScope` (`GLOBAL` | `STORE`), `Category.shopId`, `Order.affiliateCode`
- `GET /categories?shopId=&scope=` — lista híbrida
- `POST /seller/categories` — categoria da loja (tenant STORE)
- `GET /seller/products` — produtos do tenant (shop)
- CRUD produtos usa `CurrentTenant` + `resolveTenantShopId` (não confia só no `shopId` do body)
- Seller UI: criar produto + criar categoria da loja + picker global/loja

### Afiliados
- Marketplace: `AffiliateRefCapture` guarda `ishopine-ref` e chama `POST /affiliate/click/:code`
- Checkout envia `affiliateCode`
- Pedido grava `affiliateCode`; `settlePaidOrders` chama `registerConversion` (idempotente por order+link)
- `GET /affiliate/rewards` + summary com aliases (`linksCount`, `commissionsCents`, …)
- App afiliados: criar link, listar, recompensas alinhadas à API
- `trackClick` devolve `href` com slug real do produto/loja

### Extra
- `GET /orders/selling` filtra por `tenant.shopId` quando presente

## Fluxo afiliado

```
Buyer abre /produtos/x?ref=CODE
  → click API (+1)
  → localStorage ishopine-ref
Checkout
  → order.affiliateCode = CODE
PaySuite PAID → settlePaidOrders
  → AffiliateReward PENDING (bps do link)
```

## Próximo (Fase 3)

Ver [`docs/PHASE3.md`](./PHASE3.md).

Histórico: catálogo híbrido + afiliados E2E.
