# Production mode remediation - local review, 2026-10-10

## Result: PARTIAL REMEDIATION / NO-GO

Implementation is available for review, NOT deployment. Six audit reports read before changes. No commit/push/merge/deploy, DB connection/write/migration, Stripe action or remote configuration change. Store docs/ untouched. Existing audit reports remain historical evidence; this document supersedes their source-blocker observations only for the present uncommitted diff.

IMPORTANT: production server intentionally refuses startup with PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED before importing Prisma/Stripe. There is no env bypass. Legacy ownership recovery and reservation compatibility remain unresolved; silently switching existing orders to required grants would break them. This explicit stop is tested. Do NOT deploy this partial work. Production app behavior is exercised only in isolated tests with synthetic dependencies.

## Root causes and changes

| Blocker | Cause | Local remediation / status |
|---|---|---|
|Navigation handoff|Backend routes and frontend feature activation depended on staging|Production app option supports exact-origin navigation; existing frontend flag works in production/staging modes. Backend explicit creation switch does not disable redemption of issued tickets. VERIFIED in local tests; deployment blocked|
|Anonymous guest access|Production server used createApp defaults with required access false|Production app overrides false to mandatory access. Production entry wires secure options, but stops before startup pending legacy strategy. VERIFIED denial/active/revoked/expired/wrong-order grant tests with fake persistence|
|Legacy orders|Old order/session IDs are not ownership credentials; missing grants and reservations|BLOCKED. No grants/backfills/reservations invented, no old total/session rewritten; explicit startup stop prevents a silent cutover|
|Recovery|Existing recovery primitive has no configured delivery adapter or verified end-to-end recovery UX|BLOCKED. Provider, verified delivery, recovery UI/security/privacy and operating process must be reviewed; no email sent|
|Shipping|Controller keyed shipping to staging marker|Independent shippingEnabled app option; mandatory for production app. New orders use 5 below 200, zero at/above 200 before discount. Existing snapshots untouched. Frontend estimate independent of navigation activation in production/staging|
|CORS|Production omitted allowedOrigins|Production parser requires exact configured HTTPS Store/Checkout/API origins and server supplies allowlist. Navigation uses separate exact source/recipient origin checks|
|Environment isolation|Only staging had strict startup parser|Pure production parser validates target/host/TLS, live key shape, secret separation, origins and literal return templates; rejects staging config and API override. NODE_ENV production requires explicit deployment mode. Production webhook/retrieved-session TEST rejection added|

No payment engine, amount reconciliation, cart fingerprint/revision, confirmation, return-to-Store mechanism or Prisma SQL changed. Same-tab navigation stays intact. Staging defaults and TEST-only guards retained. Mirror remains unchanged.

## Required configuration (not configured remotely)

Backend explicit production settings:

- DEPLOYMENT_ENV=production
- NODE_ENV=production
- DATABASE_URL: PostgreSQL URI targeting exactly magiccitydb_3334, host matching independently verified production service; sslmode=require or verify-full
- PRODUCTION_DATABASE_HOST: newly introduced, exact separately verified production DB hostname
- PRODUCTION_STORE_ORIGIN, PRODUCTION_CHECKOUT_ORIGIN, PRODUCTION_API_ORIGIN: newly introduced, three distinct exact HTTPS origins, no credentials/path/query/fragment; no staging/local/example.invalid destinations
- CHECKOUT_APP_URL: exact PRODUCTION_CHECKOUT_ORIGIN, no trailing slash
- STRIPE_SUCCESS_URL: Checkout origin plus /order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}, literal template/order enforced
- STRIPE_CANCEL_URL: Checkout origin plus /checkout-landing?orderId={ORDER_ID}, literal template enforced
- NAVIGATION_HANDOFF_ENABLED: newly introduced backend flag, exact true/false; controls new creations only. false retains redemption; access and shipping stay secure
- NAVIGATION_HANDOFF_SECRET: existing dedicated >=32-character random secret; stable while tickets exist; distinct JWT/Stripe; never frontend
- JWT_SECRET: >=32-character production secret distinct from ticket/Stripe
- STRIPE_SECRET_KEY: dedicated LIVE sk_live_ key, correct account must be checked manually
- STRIPE_WEBHOOK_SECRET: LIVE destination whsec_ secret, correct mode/account must be checked manually
- STRIPE_CURRENCY=eur

NODE_VERSION=24.19.0 is the tested platform pin; PORT supplied by platform, valid integer. JWT_EXPIRES_IN optional with existing default; approved short lifetime recommended. STRIPE_API_VERSION must be unset in the new strict production path. STAGING_* variables must be absent/empty in production; DIRECT_URL unused; ADMIN_* seed inputs are not runtime auth configuration. Secrets are validated without displaying values. Prefix checks do not prove Stripe account ownership. No value has been installed remotely.

Store: existing VITE_API_URL (verified production API + /api), VITE_CHECKOUT_ORIGIN (trusted production Checkout), VITE_NAVIGATION_HANDOFF_ENABLED=true for desired flow, VITE_AUTOMATIC_HANDOFF=false.
Checkout: existing authoritative VITE_PRIMARY_API_URL (production API + /api), VITE_STORE_ORIGIN (trusted primary Store), VITE_ROUTER_BASENAME=/, VITE_NAVIGATION_HANDOFF_ENABLED=true, VITE_AUTOMATIC_HANDOFF=false.
Both build with ordinary MODE=production. Public builds must omit local simulator/common DEV variables and contain no secrets. No frontend variable names invented. Backend new names follow the existing staging origin/host architecture and configure existing application options, documented before implementation.

## Exact application/test files changed

Store (relative to Magic_city_git):

- drip_frontend/src/lib/navigationHandoff.ts
- drip_frontend/scripts/run-tests.mjs
- drip_frontend/tests/production-mode.test.ts (new)

Checkout (relative to Magic_city_checkout_security):

- seamless_checkout_flow/src/lib/secureCheckout.ts
- seamless_checkout_flow/scripts/run-tests.mjs
- seamless_checkout_flow/tests/production-mode.test.ts (new)

Backend (relative to Magic_city_backend_security):

- drip_backend/src/productionConfiguration.ts (new)
- drip_backend/src/runtimeConfiguration.ts
- drip_backend/src/server.ts
- drip_backend/src/app.ts
- drip_backend/src/routes/navigationHandoffRoutes.ts
- drip_backend/src/controllers/orderController.ts
- drip_backend/src/controllers/stripeWebhookController.ts
- drip_backend/src/services/stripeClient.ts
- drip_backend/tests/runtime-production.test.cjs (new)
- drip_backend/tests/contracts.test.cjs
- drip_backend/tests/run-tests.cjs

Documentation/evidence added only under tools/staging/audits/2026-10-10-production-readiness: PRODUCTION_REMEDIATION_DESIGN.md (written before implementation), this report, remediation/GIT_SCOPE.json, validation JSON/logs and isolated build outputs. Generated artifacts are evidence, not intended application commit content. No index changes.

## Tests and commands

Executed via node CLI with sanitized environment and synthetic loopback-port-1 DB URL that was never contacted:

- Backend: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json; node node_modules/typescript/bin/tsc; node tests/run-tests.cjs
- Frontends: node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json / tsconfig.node.json / tsconfig.tests.json; node scripts/run-tests.mjs
- Both frontend builds: node node_modules/vite/bin/vite.js build; additional --mode production builds with explicit synthetic HTTPS public origins and handoff enabled. Outputs isolated under remediation/, not deployed
- Backend: node node_modules/prisma/build/index.js validate
- Cross-app: node tools/staging/common-access-tests.cjs (compiled source/VM, no DB)
- All three worktrees: git diff --check and git diff --cached --check

| Validation | Final result |
|---|---|
|Backend TypeScript/build|PASS|
|Store TypeScript/build|PASS, including configured production build|
|Checkout TypeScript/build|PASS, including configured production build|
|Prisma validate|PASS|
|Backend non-DB/mock/loopback tests|49 PASS|
|Store|118 PASS|
|Checkout|92 PASS|
|Cross-app source/VM|20 PASS|
|Total executed test cases|279 PASS (includes mode matrices, not 279 unique business scenarios)|
|Git diff checks three worktrees|PASS; indexes unchanged|
|DB integration/migration harness/browser/live Stripe|NOT RUN; outside authorized scope|

Production tests cover CORS/preflight/denials, exact-order active/revoked/expired grants, anonymous legacy/current denial, issuance switch with retained redemption, strict env separation, signature/event-mode check, retrieved-session-mode check, startup stop before clients, shipping before-discount boundaries, HTTP order/pay total 1490 cents and historical amount unchanged. Existing full navigation suites run in both production and staging frontend modes; simulator matrix remains unchanged. One first-pass VM test used the host process environment instead of injected config; corrected test harness and final rerun PASS. It was not a runtime failure.

## Remaining gates and review request

16 migrations unchanged; no new schema migration. Production history/pending list remains UNKNOWN and must be audited separately before any migration authorization. Legacy-order/in-flight session inventory, verified recovery transport/UI and legacy reservation handling remain BLOCKED. No fabricated ownership proof, no anonymous fallback and no silent cutover.

Manual: independent production service/DB identity, real domains/CORS alignment, LIVE account/webhook/key ownership, env secret rotation/storage, distributed limits/reconciliation operations, privacy/logging and Linux/browser validation. Backup compatibility, encrypted archive and isolated restore rehearsal still required under separate authorization. Existing reports contain the guarded operational procedures.

Production startup blocker must not be removed merely by configuration. Review and resolve the actual legacy/recovery strategy before a separately authorized code change removes it. Then backup/migration/backend/Checkout/Store rollout and compatible rollback can be reconsidered. Current verdict NO-GO. Request review of this local partial implementation; no commit/push/deploy authorized or performed.
