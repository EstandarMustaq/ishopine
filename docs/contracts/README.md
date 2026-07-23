# Carrier / partner contracts

Drop vendor OpenAPI (or equivalent signed contract specs) here before any
live HTTP adapter is written.

## Correios de Moçambique

**Expected file:** `correios-mz.openapi.yaml`  
(override path with `CORREIOS_MZ_OPENAPI_PATH`)

### Enablement checklist (all required — no theatre)

1. Signed commercial/API contract with Correios MZ
2. OpenAPI (or equivalent) checked into this folder
3. Adapter generated **from that OpenAPI** under `services/logistics/src/carriers/`
4. Env: `CORREIOS_MZ_CONTRACTED=1` + `CORREIOS_MZ_API_*` credentials
5. Partners report flips `mode: "http"` / `configured: true` only then

Until then: `mode: "unavailable"`, `mapsTo: "MANUAL"`, `live: false`.
Do **not** invent quote/label HTTP clients.
