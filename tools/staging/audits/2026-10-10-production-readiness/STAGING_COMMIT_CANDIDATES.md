# Candidats staging ? listes courantes, aucun index modifie

> Superseded by FINAL_COMMIT_MANIFEST.md and FINAL_LOCAL_RELEASE_PREPARATION.md. Final backend scope is 39 files, including stripeApiVersion.ts and the already tracked placeholder .env.staging.example. The old counts/template tracking statement below are retained as prior review evidence, not current instructions.

## Store ? 3

- `drip_frontend/scripts/run-tests.mjs`
- `drip_frontend/src/lib/navigationHandoff.ts`
- `drip_frontend/tests/production-mode.test.ts`

## Checkout ? 3

- `seamless_checkout_flow/scripts/run-tests.mjs`
- `seamless_checkout_flow/src/lib/secureCheckout.ts`
- `seamless_checkout_flow/tests/production-mode.test.ts`

## Backend ? 37

- `drip_backend/prisma/schema.prisma`
- `drip_backend/src/app.ts`
- `drip_backend/src/controllers/guestOrderAccessController.ts`
- `drip_backend/src/controllers/orderController.ts`
- `drip_backend/src/controllers/stripeWebhookController.ts`
- `drip_backend/src/middlewares/guestOrderAccess.ts`
- `drip_backend/src/routes/navigationHandoffRoutes.ts`
- `drip_backend/src/routes/orderHandoffRoutes.ts`
- `drip_backend/src/runtimeConfiguration.ts`
- `drip_backend/src/server.ts`
- `drip_backend/src/services/guestOrderAccess.ts`
- `drip_backend/src/services/legacyReservation.ts`
- `drip_backend/src/services/navigationHandoff.ts`
- `drip_backend/src/services/orderHandoff.ts`
- `drip_backend/src/services/orderIdempotency.ts`
- `drip_backend/src/services/paymentService.ts`
- `drip_backend/src/services/reservationReconciliation.ts`
- `drip_backend/src/services/reservations.ts`
- `drip_backend/src/services/stripeClient.ts`
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
- `drip_backend/tests/runtime-staging.test.cjs`
- `drip_backend/prisma/migrations/20261010120000_add_secure_order_policy/migration.sql`
- `drip_backend/prisma/migrations/20261010150000_add_historical_webhook_receipt/migration.sql`
- `drip_backend/src/productionConfiguration.ts`
- `drip_backend/src/services/historicalWebhookReceipt.ts`
- `drip_backend/src/services/secureOrderPolicy.ts`
- `drip_backend/tests/runtime-production.test.cjs`
- `drip_backend/tests/secure-order-policy.integration.test.cjs`

## Outillage/docs ? revue selective, jamais git add .

- `tools/staging/offline-stripe.cjs`
- `tools/staging/offline-stripe.test.cjs`
- `tools/staging/validate-stripe-offline.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/.gitignore`
- `tools/staging/audits/2026-10-10-production-readiness/BACKUP_AND_ROLLBACK.md`
- `tools/staging/audits/2026-10-10-production-readiness/CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/DATABASE_MIGRATION_PLAN.md`
- `tools/staging/audits/2026-10-10-production-readiness/DEPLOYMENT_RUNBOOK.md`
- `tools/staging/audits/2026-10-10-production-readiness/GO_NO_GO_PRODUCTION.md`
- `tools/staging/audits/2026-10-10-production-readiness/HISTORICAL_WEBHOOK_REVIEW_RUNBOOK.md`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_COMPATIBILITY_PRODUCTION_PLAN.md`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_FINAL_REVIEW.md`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql`
- `tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_READ_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/POSTGRES18_LOCAL_SQL_VALIDATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/prepare-policy-rollback.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_18_AUDIT_ROLE_REVIEW.md`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_ENV_CHECKLIST.md`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_REMEDIATION_DESIGN.md`
- `tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_REMEDIATION_REPORT.md`
- `tools/staging/audits/2026-10-10-production-readiness/release-check.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/SECURE_ORDER_POLICY_IMPLEMENTATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_BACKUP_RESTORE_PLAN.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_BLOCKERS_RESOLUTION.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_COMMIT_CANDIDATES.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_GO_NO_GO.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_RELEASE_VALIDATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/STAGING_TRANSITION_READ_ONLY.sql`
- `tools/staging/audits/2026-10-10-production-readiness/STRIPE_ENV_COMPATIBILITY.md`
- `tools/staging/audits/2026-10-10-production-readiness/STRIPE_LIVE_CHECKLIST.md`
- `tools/staging/audits/2026-10-10-production-readiness/STRIPE_OFFLINE_VALIDATION.md`
- `tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-pg18.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-regression-pg18.cjs`
- `tools/staging/audits/2026-10-10-production-readiness/pg18-simulation/run-postgres18.cjs`

Exclure docs/ preexistant, .runtime, node_modules, dist/builds, resultats/logs/JSON, baseline, rollback/dumps et secrets. SQL administratifs sont des documents de revue, jamais des commandes de release automatiques.

Le template drip_backend/.env.staging.example est actuellement ignore et non suivi (check-ignore confirme). Il contient seulement des placeholders ; aucun ajout force a l index. Les 37 candidats backend ordinaires ne l incluent pas. Une inclusion future exige revue explicite.
