# iShoppine

Marketplace aberto oficial **iShoppine** — operado por **Nkateko Investment and Service**.

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
pnpm --filter @ishoppine/api start:dev
pnpm --filter @ishoppine/web dev
```

- Marketplace: http://localhost:3000  
- API: http://localhost:4000/api/health  

## Contas demo

Senha: `IShoppine@2026`

| Perfil | E-mail |
|--------|--------|
| Admin | `admin@ishoppine.com` |
| Operador | `operador@ishoppine.com` |
| Vendedor 1 | `vendedor1@ishoppine.com` |
| Vendedor 2 | `vendedor2@ishoppine.com` |
| Comprador | `comprador@ishoppine.com` |

Cupons seed: `ISHOP10` (10%) · `BEMVINDO50` (R$ 50)

## Licença

GNU GPL v3 — ver `LICENSE`.  
Produto **iShoppine** · Operador **Nkateko Investment and Service**.
