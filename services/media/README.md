# Media (strangler — owned)

Porta **4105**. Com `MEDIA_OWNED≠0` (default):

| Path | Notas |
|---|---|
| `POST/GET/DELETE /api/media`, `/api/uploads` | JWT + Prisma + Sharp/Cloudinary |
| `GET /api/media/cdn` | Phase 23 — delivery status (`MEDIA_CDN_HOST` / Cloudinary edge) |
| `GET /uploads/*` | estático local + `Cache-Control` immutable |

Gateway encaminha `/uploads` → `MEDIA_URL` quando `STRANGLER_ROUTING=1`.

```bash
JWT_SECRET=… DATABASE_URL=…
# MEDIA_CDN_HOST=cdn.ishopine.com
# MEDIA_PUBLIC_BASE_URL=https://cdn.ishopine.com
pnpm --filter @ishopine/media dev
```

`MEDIA_OWNED=0` → proxy puro.
