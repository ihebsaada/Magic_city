# Final selective commit manifest - 2026-10-10

Review only. No index or commit created. This supersedes STAGING_COMMIT_CANDIDATES.md. Paths are relative to each worktree. .env.staging.example is a tracked placeholder template; real env files are excluded. Administrative SQL files are review documents, never release hooks.

## Backend (39)

- `drip_backend/.env.staging.example`
- `drip_backend/prisma/migrations/20261010120000_add_secure_order_policy/migration.sql`
- `drip_backend/prisma/migrations/20261010150000_add_historical_webhook_receipt/migration.sql`
- `drip_backend/prisma/schema.prisma`
- `drip_backend/src/app.ts`
- `drip_backend/src/controllers/guestOrderAccessController.ts`
- `drip_backend/src/controllers/orderController.ts`
- `drip_backend/src/controllers/stripeWebhookController.ts`
- `drip_backend/src/middlewares/guestOrderAccess.ts`
- `drip_backend/src/productionConfiguration.ts`
- `drip_backend/src/routes/navigationHandoffRoutes.ts`
- `drip_backend/src/routes/orderHandoffRoutes.ts`
- `drip_backend/src/runtimeConfiguration.ts`
- `drip_backend/src/server.ts`
- `drip_backend/src/services/guestOrderAccess.ts`
- `drip_backend/src/services/historicalWebhookReceipt.ts`
- `drip_backend/src/services/legacyReservation.ts`
- `drip_backend/src/services/navigationHandoff.ts`
- `drip_backend/src/services/orderHandoff.ts`
- `drip_backend/src/services/orderIdempotency.ts`
- `drip_backend/src/services/paymentService.ts`
- `drip_backend/src/services/reservationReconciliation.ts`
- `drip_backend/src/services/reservations.ts`
- `drip_backend/src/services/secureOrderPolicy.ts`
- `drip_backend/src/services/stripeClient.ts`
- `drip_backend/src/stripeApiVersion.ts`
- `drip_backend/tests/catalog.integration.test.cjs`
- `drip_backend/tests/contracts.test.cjs`
- `drip_backend/tests/guest-access.integration.test.cjs`
- `drip_backend/tests/handoff.integration.test.cjs`
- `drip_backend/tests/idempotency.integration.test.cjs`
- `drip_backend/tests/navigation.integration.test.cjs`
- `drip_backend/tests/payment.integration.test.cjs`
- `drip_backend/tests/reservations.integration.test.cjs`
- `drip_backend/tests/run-postgres-tests.cjs`
- `drip_backend/tests/run-tests.cjs`
- `drip_backend/tests/runtime-production.test.cjs`
- `drip_backend/tests/runtime-staging.test.cjs`
- `drip_backend/tests/secure-order-policy.integration.test.cjs`

## Checkout (3)

- `seamless_checkout_flow/scripts/run-tests.mjs`
- `seamless_checkout_flow/src/lib/secureCheckout.ts`
- `seamless_checkout_flow/tests/production-mode.test.ts`

## Store (3)

- `drip_frontend/scripts/run-tests.mjs`
- `drip_frontend/src/lib/navigationHandoff.ts`
- `drip_frontend/tests/production-mode.test.ts`

## Outillage et documentation (47)

- `tools/staging/audits/2026-10-10-production-readiness/.gitignore`
- `tools/staging/audits/2026-10-10-production-readiness/BACKUP_AND_ROLLBACK.md`
- `tools/staging/audits/2026-10-10-production-readiness/CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/DATABASE_MIGRATION_PLAN.md`
- `tools/staging/audits/2026-10-10-production-readiness/DEPLOYMENT_RUNBOOK.md`
- `tools/staging/audits/2026-10-10-production-readiness/FINAL_COMMIT_MANIFEST.md`
- `tools/staging/audits/2026-10-10-production-readiness/FINAL_LOCAL_RELEASE_PREPARATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/FULL_OFFLINE_E2E_VALIDATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/GO_NO_GO_PRODUCTION.md`
- `tools/staging/audits/2026-10-10-production-readiness/HISTORICAL_WEBHOOK_REVIEW_RUNBOOK.md`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_COMPATIBILITY_PRODUCTION_PLAN.md`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_FINAL_REVIEW.md`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_READ_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/PLAYWRIGHT_OFFLINE_E2E.md`
- `tools/staging/audits/2026-10-10-production-readiness/POSTGRES18_LOCAL_SQL_VALIDATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_18_AUDIT_ROLE_REVIEW.md`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_ENV_CHECKLIST.md`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_REMEDIATION_DESIGN.md`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_REMEDIATION_REPORT.md`
- `tools/staging/audits/2026-10-10-production-readiness/REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/SECURE_ORDER_POLICY_IMPLEMENTATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/SELECTIVE_COMMITS_REVIEW_ONLY.ps1`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_BACKUP_RESTORE_PLAN.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_BLOCKERS_RESOLUTION.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_COMMIT_CANDIDATES.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_GO_NO_GO.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_RELEASE_VALIDATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_TRANSITION_READ_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/STRIPE_ENV_COMPATIBILITY.md`
- `tools/staging/audits/2026-10-10-production-readiness/STRIPE_LIVE_CHECKLIST.md`
- `tools/staging/audits/2026-10-10-production-readiness/STRIPE_OFFLINE_VALIDATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/pg18-simulation/run-postgres18.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/prepare-policy-rollback.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/qualify-linux-rollback.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/release-check.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/rollback-linux.Dockerfile`
- `tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-pg18.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-regression-pg18.cjs`
- `tools/staging/backend.cjs`
- `tools/staging/final-flow-scenario.cjs`
- `tools/staging/frontend.mjs`
- `tools/staging/offline-stripe.cjs`
- `tools/staging/offline-stripe.test.cjs`
- `tools/staging/playwright-offline.cjs`
- `tools/staging/start.cjs`
- `tools/staging/validate-stripe-offline.cjs`

## Explicit exclusions

- Preexisting docs/ (all three files untouched).
- .runtime/, node_modules/, dist/, build outputs and caches.
- release-review/ including image TAR, rollback copies, manifests JSON, logs and screenshots.
- remediation/, legacy-compatibility/, build-store/, build-checkout/, secure-policy/baseline and build copies.
- Generated JSON/logs, pg18-simulation/*.txt, dumps, DB data, archives and .pg-* directories.
- Actual .env files, passwords, tokens, credentials and private keys.

No git add . or recursive directory addition. Each file must pass the targeted secret scan and cached diff review before a future authorized commit.
