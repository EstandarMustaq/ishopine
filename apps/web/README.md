# iShopine Web

Frontend Next.js do **iShopine** — mercado aberto de bens (compre e venda).  
Operado por **Nkateko Investment and Service**.

## Desenvolvimento

```bash
pnpm --filter @ishopine/web dev
```

Abra [http://localhost:3000](http://localhost:3000).

Configure a API em `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/` | Home do mercado |
| `/produtos` | Catálogo público |
| `/produtos/[id]` | Detalhe do produto (usa id — slug é único por loja) |
| `/lojas` | Lista de lojas |
| `/lojas/[slug]` | Vitrine da loja |
| `/vender` | CTA para abrir loja |
| `/entrar` | Login + Google + 2FA inline |
| `/cadastro` | Registro |
| `/verificar-email` | Código de e-mail |
| `/auth/callback` | Retorno Google (`accessToken`) |
| `/auth/2fa` | 2FA pós-Google |
| `/conta` | Pedidos de compra |
| `/conta/disputas` | Disputas do comprador |
| `/favoritos` | Wishlist |
| `/notificacoes` | Notificações |
| `/mensagens` | Conversas buyer↔seller |
| `/painel` | Painel (vendedores / staff) |
| `/painel/loja` | Criar/gerenciar loja |
| `/painel/cupons` | Cupons (admin) |
| `/painel/disputas` | Disputas (admin) |
| `/painel/seguranca` | Setup 2FA |

Demo: `admin@ishopine.com` / `IShopine@2026`
