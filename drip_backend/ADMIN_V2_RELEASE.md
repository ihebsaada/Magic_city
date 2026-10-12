# Backend V2 Admin compatibility release

Baseline: `origin/dripBackend` at `829bcbc6209b60af332029c08131ea7ea19872ff`. Backend tree was identical to `origin/main` at `dd9d88fe8577fb7c31a3bbf3a0e7945900643887`. Changes are confined to `drip_backend`. No Prisma schema or migration file changes.

## Required production configuration

Add exactly:

```text
PRODUCTION_ADMIN_ORIGIN=https://magicadmindrip.netlify.app
```

This is a required, exact HTTPS origin without path, trailing slash, query, credentials or fragment. It must differ from the existing Store/Checkout/API origins. Existing settings and secrets remain in place. The general origin gate and CORS both consume this expanded list through the existing server wiring. Admin is not included in Store/Checkout handoff origins.

Do not change JWT secrets, database URLs, currencies, payment settings or authorization guards for this release. Do not print secret values.

## Contracts and corrections

- All 19 existing Admin service contracts remain available; the Admin additionally uses the previously unused PUT product-collection endpoint.
- PATCH product accepts an additive `variantUpdate` object with required `variantId`. It saves metadata, explicitly edited images and that variant in one Prisma transaction. Stock changes reuse existing reservation checks and row locks.
- Legacy `collectionIds` on product PATCH is supported transactionally for existing Admin builds. The updated Admin uses the dedicated association PUT, which validates all IDs before replacement and preserves existing selected links.
- Image URLs validate on the backend; unchanged image lists preserve rows/IDs. Failed image/product/variant mutations roll back together.
- Variant updates cannot create a variant implicitly. Missing records return 404. Money validates EUR precision; nullable SKU can be explicitly cleared. No reserved counter can be changed through Admin payloads.
- Product deletion refuses order or reservation history. Collection deletion is transactional. Prisma duplicate/reference/missing-record errors are safely normalized for Admin requests.
- Discount amounts/types/limits/expiry validate; reserved-use protections and historical deletion protections remain. Unchanged legacy rules are not rewritten during deactivation.
- Order list/detail add `canEdit`, structured `readOnlyReason` and `allowedStatuses`, derived from existing SecureOrderPolicy and transition rules. No database column was added. Historical/payment protection services are unchanged. The Admin does not expose manual payment-state modification.
- Existing product mutation collection-link shape is preserved. Store/Checkout public response shapes remain unchanged.

## Tests

```powershell
npm ci --include=dev
npm run prisma:generate
npm run build
npm test
npm run test:admin-v2
```

The Admin V2 runner uses PostgreSQL 17 binaries (override `PG_TEST_BIN` if needed), creates a **new** cluster under ignored `tests/.pg-admin-v2-*`, binds it only to `127.0.0.1` and uses a synthetic `lot4_isolated` database. It strips inherited database, JWT, Stripe and handoff configuration. It creates the test schema with `prisma db push`, reproduces V2 CHECK constraints only in that fresh schema, and uses synthetic fixtures plus simulated Stripe.

No migration command, deployment, seed script or production API is called. The stopped cluster and ignored per-suite logs remain available for inspection. An existing test specifically requiring completed migration history is explicitly excluded: this release does not qualify migrations or populate fake migration history. Other historical-data tests run against synthetic archival rows; their old names mentioning migrations do not mean migrations were executed.

## Controlled deployment and rollback

1. Human operator verifies Render production service, branch `dripBackend`, actual deployed SHA, automatic deployments, build/start/predeploy commands and healthcheck. Do not push until automatic deployment is disabled and approval is granted.
2. Preserve the current Render artifact and configuration for rollback. Verify the start command contains **no migration**; use `npm run start` (`node dist/server.js`). Verify no predeploy migration hook is enabled for this release. No migration is required.
3. Set the new Admin origin only under human control; setting an environment variable may itself trigger a deploy, so use the provider's save-without-deploy option or the approved release window. The old artifact ignores this extra variable; the new artifact requires it.
4. Build the reviewed exact commit using `npm ci --include=dev && npm run prisma:generate && npm run build`, root `drip_backend`. These commands do not run migrations.
5. Manually deploy the reviewed exact commit. The existing startup readiness guard remains enabled. Do not bypass it if it refuses startup; inspect the existing schema/configuration read-only.
6. Zero interruption requires a replacement instance healthy before traffic cutover. Verify that Render's service configuration supports this; otherwise use a reviewed blue/green procedure. Do not promise uninterrupted deployment from an unverified provider setting.
7. Verify `GET /healthz` without Origin, Admin OPTIONS login/products/collections/orders/PUT/DELETE, anonymous Admin GET returning 401 with matching ACAO, foreign origin returning 403, and Admin-origin handoffs returning 403. Then publish Admin from **adminHub**, never main.
8. Roll back application artifacts only. Restore the previous Admin first when the backend additive contract is being removed. Retain all production data and secrets. No database restore, migration, reset, import or force push.

No push/deploy or production environment change was performed as part of implementation. Netlify's actual production branch and automation configuration require operator confirmation.
