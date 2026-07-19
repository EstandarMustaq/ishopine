# Nkateko Marketplace

Marketplace aberto da **Nkateko Investment and Service** — compra e venda de bens entre múltiplos usuários e lojas.

Não é uma loja única: é um **mercado multi-vendedor**, multi-usuário, com arquitetura preparada para multi-tenant (`Organization`).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| API | NestJS 11, Passport JWT + Google OAuth, TOTP 2FA |
| Banco | PostgreSQL (Neon) + Prisma |
| Mídia | Upload local ou Cloudinary |
| Auth | E-mail + código OTP · Google · 2FA (TOTP) no painel |

## Monorepo

```
apps/web   → marketplace + painéis
apps/api   → API REST + Prisma
```

## Segurança (nível marketplace)

1. **Cadastro** → código de 6 dígitos enviado ao e-mail → verificação obrigatória  
2. **Login** e-mail/senha ou **Google OAuth**  
3. **2FA (TOTP)** obrigatório para vendedores e staff da plataforma no painel  
4. Rate limiting em rotas de autenticação  
5. Sessões pendentes de 2FA com token de curta duração  

## Papéis

| Papel | Escopo |
|-------|--------|
| `BUYER` | Compra no mercado |
| `SELLER` | Compra + vende (loja própria) |
| `PLATFORM_OPERATOR` | Operação do marketplace |
| `PLATFORM_ADMIN` | Administração total + contabilidade |

Qualquer usuário verificado pode **abrir uma loja** e passar a comprar e vender.

## Começar

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
# DATABASE_URL, JWT_SECRET, opcionalmente Google e SMTP

cp apps/web/.env.example apps/web/.env.local

pnpm db:push
pnpm db:seed

pnpm --filter @nkateko/api start:dev
pnpm --filter @nkateko/web dev
```

- Marketplace: http://localhost:3000  
- API: http://localhost:4000/api/health  

### Google OAuth

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
WEB_URL=http://localhost:3000
```

### E-mail (OTP)

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Nkateko <noreply@nkateko.com>"
```

Sem SMTP em desenvolvimento, o código OTP é impresso no console da API e pode vir como `devCode` na resposta.

## Contas demo (seed)

Senha: `Nkateko@2026`

| Perfil | E-mail |
|--------|--------|
| Admin plataforma | `admin@nkateko.com` |
| Operador | `operador@nkateko.com` |
| Vendedor 1 (Casa Atlas) | `vendedor1@nkateko.com` |
| Vendedor 2 (Studio Horizonte) | `vendedor2@nkateko.com` |
| Comprador | `comprador@nkateko.com` |

## Funcionalidades

### Mercado (público)
- Catálogo multi-loja, categorias, busca e filtros  
- Páginas de lojas (`/lojas`)  
- Carrinho e checkout (pedido separado por loja vendedora)  
- Conta do comprador  

### Vendedor
- Abrir/gerir loja  
- Produtos, estoque, pedidos recebidos  
- 2FA no painel  

### Plataforma (Nkateko)
- Overview (lojas, GMV, pedidos)  
- Usuários, contabilidade, configurações  
- Comissão configurável (`commissionBps`)  

### Multi-tenant (futuro)
Modelo `Organization` já isola dados por organização; hoje opera com a org `nkateko`.

## CDN

```env
UPLOAD_PROVIDER=local
# ou cloudinary + CLOUDINARY_*
```

## Licença

GNU GPL v3 — ver `LICENSE`.  
Projeto da **Nkateko Investment and Service** para cliente.
