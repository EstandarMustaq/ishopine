# iShopine

Marketplace **moçambicano** — de Moçambique para Moçambique.  
Domínio: [ishopine.com](https://ishopine.com)

Multi-vendedor, multi-utilizador, autenticação Google + OTP + 2FA, pronto para multi-tenant.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| API | NestJS 11, Passport JWT + Google OAuth, TOTP 2FA |
| Banco | PostgreSQL (Neon) + Prisma |
| Pagamentos | **[PaySuite](https://paysuite.co.mz)** (M-Pesa, e-Mola, cartões) |
| Mídia | Upload local ou Cloudinary |

## Pagamentos (PaySuite)

iShopine usa a API oficial PaySuite (`https://paysuite.tech/api/v1`), alinhada ao SDK PHP [`hypertech/paysuite-php-sdk`](https://github.com/hypertech-lda/paysuite-php-sdk).

| Método | Código API |
|--------|------------|
| M-Pesa | `mpesa` |
| e-Mola | `emola` |
| Cartão Visa/Mastercard | `credit_card` |

Moeda: **MZN** (meticais).  
**Não há sandbox** — ao activar a conta PaySuite, as transacções são reais.

### Endpoints

- `POST /api/billing/paysuite/checkout` — cria cobrança + `checkout_url`
- `GET /api/billing/paysuite/status/:paymentId` — sincroniza estado
- `POST /api/billing/paysuite/webhook` — `payment.success` / `payment.failed` (HMAC `X-Webhook-Signature`)
- `POST /api/billing/paysuite/payouts` — payouts (admin)
- `POST /api/billing/paysuite/refunds` — reembolsos (admin)
- `GET /api/billing/payments` — histórico do comprador

### Variáveis

```bash
PAYSUITE_TOKEN=           # painel PaySuite → Settings → API Access
PAYSUITE_WEBHOOK_SECRET=  # validação HMAC dos webhooks
PAYSUITE_BASE_URL=https://paysuite.tech/api/v1
APP_URL=https://api.ishopine.com   # callback_url público
WEB_URL=https://ishopine.com
# Só para demos locais sem token:
PAYSUITE_SIMULATE=true
```

Webhook URL no painel: `https://<api>/api/billing/paysuite/webhook`

## Começar

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:push && pnpm db:seed
pnpm --filter @ishopine/api start:dev
pnpm --filter @ishopine/web dev
```

- Marketplace: http://localhost:3000  
- API: http://localhost:4000/api/health  

## Contas demo

Senha: `IShopine@2026`

| Perfil | E-mail |
|--------|--------|
| Admin | `admin@ishopine.com` |
| Operador | `operador@ishopine.com` |
| Vendedor 1 | `vendedor1@ishopine.com` |
| Vendedor 2 | `vendedor2@ishopine.com` |
| Comprador | `comprador@ishopine.com` |

Cupons seed: `ISHOP10` (10%) · `BEMVINDO50`

## Licença

GNU GPL v3 — ver `LICENSE`.  
**iShopine** · Moçambique.
