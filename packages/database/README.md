# @ishopine/database

Canonical home for the Prisma schema **target**. Today the schema still lives at
`apps/api/prisma/` (shared by strangler services). Scripts proxy to
`@ishopine/api` until the schema is physically moved here.

```bash
pnpm --filter @ishopine/database generate
```
