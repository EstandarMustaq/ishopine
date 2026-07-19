# iShopine

Marketplace aberto oficial **iShopine** — operado por **Nkateko Investment and Service**.

Multi-vendedor, multi-usuário, com autenticação Google + OTP + 2FA e arquitetura pronta para multi-tenant.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| API | NestJS 11, Passport JWT + Google OAuth, TOTP 2FA |
| Banco | PostgreSQL (Neon) + Prisma |
| Mídia | Upload local ou Cloudinary |

## Funcionalidades

### Mercado
- Catálogo multi-loja, categorias, busca
- Páginas de lojas + seguir loja
- Favoritos / wishlist
- Avaliações de produtos (pós-compra)
- Carrinho e checkout com **cupons**
- **Billing**: Stripe Checkout (cartões) + Vodacom **M-Pesa Moçambique** C2B (paralelo — M-Pesa não passa pelo Stripe)
- Mensagens comprador ↔ vendedor
- Notificações in-app
- Disputas de pedido

### Vendedor
- Abrir/gerir loja
- Produtos, estoque, pedidos
- 2FA no painel

### Plataforma
- Overview (GMV, lojas, vendedores)
- Cupons, disputas, usuários, contabilidade
- Comissão configurável

### Segurança
1. Cadastro → código OTP no e-mail  
2. Login e-mail/senha ou Google  
3. 2FA TOTP para vendedores e staff (obrigatório em produção)  
4. Rate limiting nas rotas de auth  

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

Cupons seed: `ISHOP10` (10%) · `BEMVINDO50` (R$ 50)

## Pagamentos

Stripe e M-Pesa são provedores **paralelos** na mesma camada de billing (`BillingPayment`):

| Provedor | Uso | Integração |
|----------|-----|------------|
| **Stripe** | Cartões / métodos dinâmicos do Checkout | `POST /api/billing/stripe/checkout` + webhook `checkout.session.completed` |
| **M-Pesa MZ** | Carteira Vodacom Moçambique (USSD Push C2B) | Open API em [developer.mpesa.vm.co.mz](https://developer.mpesa.vm.co.mz/) — RSA + sessão + C2B single-stage |

Variáveis (ver `apps/api/.env.example`):

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY` (default `usd`)
- `MPESA_API_KEY`, `MPESA_PUBLIC_KEY`, `MPESA_SERVICE_PROVIDER_CODE` (sandbox `171717`), `MPESA_ENV`

Sem chaves configuradas, a API **simula** sucesso em desenvolvimento para demos locais.

Webhook Stripe: `POST /api/billing/stripe/webhook`  
Callback M-Pesa: `POST /api/billing/mpesa/callback`

## Licença

GNU GPL v3 — ver `LICENSE`.  
Produto **iShopine** · Operador **Nkateko Investment and Service**.
