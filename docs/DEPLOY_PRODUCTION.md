# Production deploy status

## Live (Vercel)

| Surface | URL |
|---|---|
| Marketplace | https://ishopine.vercel.app |
| API | https://ishopine-api.vercel.app |

## Configured (not committed)

Secrets live in Vercel Production env + local gitignored `.env` / `apps/api/.env`.

| Integration | Status |
|---|---|
| Neon `DATABASE_URL` | Schema pushed + seeded |
| Google OAuth | Client ID/secret on API; **add redirect URI in Google Console** (below) |
| SMTP Gmail | `smtp.gmail.com:587` (host corrected from `gmail.com`) |
| Cloudinary | `UPLOAD_PROVIDER=cloudinary` |
| DHL Express | MyDHL test credentials |
| PaySuite | **`PAYSUITE_ENABLED=0`** until merchant quota |

## Generated secrets (stored in Vercel / local `.env` only)

- `JWT_SECRET`
- `CRON_SECRET`
- `INTERNAL_SERVICE_SECRET`
- `CARRIER_WEBHOOK_SECRET`

## Google Cloud Console — action required

Authorized redirect URI:

```
https://ishopine-api.vercel.app/api/auth/google/callback
```

Authorized JavaScript origins (optional):

```
https://ishopine.vercel.app
https://ishopine-api.vercel.app
```

## Demo logins (after seed)

Password for all: `IShopine@2026`

- `admin@ishopine.com` — backoffice
- `vendedor1@ishopine.com` — seller
- `comprador@ishopine.com` — buyer

## SMTP note

Gmail app password is wired. `SMTP_FROM` uses `noreply@ishopine.com` but auth is the Gmail account — Gmail may rewrite the From header to the authenticated mailbox unless you use a custom domain SMTP later.

## Next Vercel projects (optional)

Seller / admin / affiliate / customer / mobile do not have dedicated Vercel projects yet. Marketplace + API are the production pair today; spin up additional projects from `apps/*` when ready (see each `vercel.json`).

## Activate PaySuite later

```
PAYSUITE_ENABLED=1
PAYSUITE_TOKEN=…
PAYSUITE_WEBHOOK_SECRET=…
PAYSUITE_SIMULATE=false
```

Then redeploy `ishopine-api`.
