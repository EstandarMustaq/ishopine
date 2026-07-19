# Mavula Móveis

Ecossistema completo de e-commerce de móveis — NestJS + Next.js + shadcn/ui + PostgreSQL (Neon) + CDN (local/Cloudinary).

Design system inspirado no Enjoei (roxo `#61005D`, tipografia Montserrat, marketplace brasileiro).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15, React 19, Tailwind, shadcn/ui |
| API | NestJS 11, Passport JWT, class-validator |
| Banco | PostgreSQL (Neon) + Prisma 6 |
| Mídia | Upload local ou Cloudinary |
| Auth / Roles | `CUSTOMER`, `OPERATOR`, `ADMIN` |

## Monorepo

```
apps/web   → loja + painel
apps/api   → API REST + Prisma
```

## Começar

```bash
pnpm install

# Configure o banco
cp apps/api/.env.example apps/api/.env
# edite DATABASE_URL e JWT_SECRET

cp apps/web/.env.example apps/web/.env.local

pnpm db:push
pnpm db:seed

# terminais separados
pnpm --filter @mavula/api start:dev
pnpm --filter @mavula/web dev
```

- Loja: http://localhost:3000  
- API: http://localhost:4000/api/health  

## Contas demo (seed)

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Administrador | `admin@mavula.com.br` | `mavula123` |
| Operador | `operador@mavula.com.br` | `mavula123` |
| Cliente | `cliente@mavula.com.br` | `mavula123` |

## Funcionalidades

### Loja
- Catálogo com filtros, categorias e destaque
- Carrinho, checkout (PIX / cartão / transferência)
- Conta do cliente com pedidos
- Design Enjoei: hero full-bleed, chips, cards, CTAs roxos

### Painel operador
- Overview (KPIs)
- Pedidos e mudança de status
- Produtos e estoque baixo
- Movimentações de inventário
- Lançamentos contábeis (rascunho)

### Painel administrador
- Tudo do operador
- Usuários e papéis
- Contabilidade: lançar / estornar
- Configurações da loja
- Upload de mídia (CDN)

### Contabilidade
Plano de contas padrão + lançamentos com débito/crédito, status `DRAFT` / `POSTED` / `VOID`. Confirmação de pedido gera receita automaticamente.

## CDN

```env
UPLOAD_PROVIDER=local          # arquivos em apps/api/uploads
# ou
UPLOAD_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Scripts

```bash
pnpm dev:web
pnpm dev:api
pnpm build
pnpm db:generate
pnpm db:push
pnpm db:seed
```

## Licença

GNU GPL v3 — ver `LICENSE`.
