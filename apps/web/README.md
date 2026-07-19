# Nkateko Web

Frontend Next.js do **Nkateko Investment and Service** — mercado aberto de bens (compre e venda).

## Desenvolvimento

```bash
pnpm --filter @nkateko/web dev
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
| `/painel` | Painel (vendedores / staff) |
| `/painel/loja` | Criar/gerenciar loja |
| `/painel/seguranca` | Setup 2FA |

Demo: `admin@nkateko.com` / `Nkateko@2026`
