# iShopine — Commerce Platform (plano fechado)

> **iShopine é a infraestrutura de comércio digital de Moçambique.**  
> O Marketplace é um produto — não o núcleo.

## Decisões aprovadas

| Tema | Decisão |
|---|---|
| Arquitectura | Microserviços **já**, via **Strangler** sobre o monólito actual |
| Serviços no dia 1 | Só os fundamentais (ver abaixo) — resto sob procura |
| Account ≠ Tenant | Uma **Account** pode ter **1 PARTICULAR + N STORE** |
| Isolamento | Por **tenant** (nunca misturar contexto Particular/Loja) |
| Backoffice | Só equipa iShopine (métricas, observability, ops) — **não** admin-deus de sellers |
| Wallet / Billing | Plataformas financeiras reutilizáveis |
| Billing | Consumo **+** serviços premium (Pricing / Subscription) |
| MVP geo | Moçambique (MZN / PaySuite) |
| Frontends | Apps separadas por domínio (marketplace / seller / affiliate / backoffice) |

## Camadas do produto

```
Commerce Platform
├── Marketplace      (produto)
├── Store Platform
├── Wallet
├── Billing + Pricing + Subscriptions
├── Affiliate
├── Payments
├── Logistics        (owned — Fase 20)
├── Developers       (owned — Fase 19)
└── Commerce APIs
```

## Account vs Tenant

```
Account (pessoa / identidade de negócio)
 └── Tenant PARTICULAR   (0..1)
 └── Tenant STORE A      (0..N)
 └── Tenant STORE B
```

- Cada pedido de API de seller leva `X-Tenant-Id` (ou claim JWT).
- Recursos são sempre scoped ao tenant activo.
- A mesma pessoa pode vender usados (Particular) e ter empresa(s) (Loja), sem segunda conta.

## Serviços fundamentais (Fase 0–4)

Criar cedo (esqueleto → extracção):

```
identity      # IAM / Auth / OAuth / 2FA / Sessions
accounts      # Account, tenants, memberships
marketplace   # superfícies de mercado (home, coleções) — fino
catalog       # produtos + categorias (global e por loja)
orders
payments
wallet        # ledger independente
billing       # faturação
```

Módulos simples no início (podem virar serviços):

```
pricing           # tabelas de preço de recursos/premium
media             # upload / resize / CDN
feature-flags
discovery/search  # separar do marketplace quando crescer
subscriptions     # benefícios Starter/Business/Enterprise
commerce-orchestrator  # checkout → payments → orders → wallet → rewards
```

**Não** criar 15 serviços no primeiro PR.

## Apps

```
marketplace.ishopine   # público
seller.ishopine        # particular + lojas (switcher de tenant)
affiliate.ishopine
backoffice.ishopine    # só staff iShopine
customer               # pode viver em marketplace no início
```

## Strangler

1. Gateway à frente do monólito `apps/api`
2. Extrair: Identity → Accounts → Catalog → Orders → Wallet…
3. Sistema permanece online durante a transição

## Fases

| Fase | Foco |
|---|---|
| **0** | Account/Tenant, authz, gateway, esqueleto serviços fundamentais |
| **1** | Apps por perfil + switcher de tenant no seller |
| **2** | Catalog híbrido (categorias globais + loja) + afiliados end-to-end |
| **3** | Orders/Checkout/Payments extraídos + Orchestrator |
| **4** | Wallet + Billing + Pricing (+ premium) |
| **5** | Store depth, Media, Feature Flags, Developer Platform |
| **6** | Cookie SSO, media owned extraction, logistics stub |
| **7** | Logistics carriers/shipments, wallet owned reads, media CDN stub |
| **8** | Production hardening: adapters reais, Sharp, authz, PaySuite |
| **9** | Orders cart/status owned + media Cloudinary/CDN base URL |
| **10** | Checkout owned + wallet settle idempotente |
| **11** | PaySuite extract (payments owned) |
| **12** | Payouts/refunds owned + CDN cache harden |
| **13** | Identity extract (auth owned + SSO cookies) |
| **14** | Affiliate extract (affiliates owned + settle remote) |
| **15** | Subscription extract (billing owned + usage remote) |
| **16** | Accounts extract (accounts owned + tenant edge) |
| **17** | Catalog extract (hybrid categories + products owned) |
| **18** | Marketplace extract (shops + ads + wishlist owned) |
| **19** | Developers extract (API keys + v1 + feature-flags owned) |
| **20** | Logistics extract (zones + shipments + HMAC webhooks owned) |
| **21** | Accounting extract (ledger owned) |
| **22** | Comms extract (notifications + messages + disputes owned) |
| **23** | Live DHL (fail-closed MyDHL) + CDN edge (Cloudinary / CNAME) |
| **24** | Coupons / inventory / reviews extracts (`:4115–4117`) |
| **25** | Checkout saga splits — remote coupon/inventory/label + orchestrator compose |
| **26** | Remote checkout E2E; addresses→accounts; accounting post remote; Correios still blocked |
| **27** | Platform-settings / dashboard extract (`:4118`); Correios still blocked |
| **28** | Platform-ops extract (`:4119`) — users admin + reliability + cron; Correios still blocked |
| **29** | Platform-security extract (`:4120`) + Correios OpenAPI gate (`docs/contracts/`); no invented HTTP |
| **30** | Google OAuth → identity; settle-paid → orders; Correios still blocked |
| **31** | Nest cleanup — legacy stripe/mpesa → payments; remove Google Passport; Correios still blocked |
| **32+** | Correios HTTP adapter when OpenAPI lands; deeper Nest module retirement |

## Fora de âmbito (MVP)

- Admin omnipotente de sellers
- Multi-país
- 15+ microserviços no dia 1
- Mobile nativo
