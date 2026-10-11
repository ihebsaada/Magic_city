# REVIEW ONLY - no commands executed during preparation.
throw 'REVIEW_ONLY: remove this stop only after separate explicit commit authorization and review.'
$ErrorActionPreference = 'Stop'

# Backend
Set-Location -LiteralPath 'C:/Users/hp/Desktop/work/magic city/Magic_city_backend_security'
if ((git branch --show-current).Trim() -ne 'staging/backend') { throw 'Wrong branch' }
if (git diff --cached --name-only) { throw 'Index must be empty' }
$releaseFiles = @(
    'drip_backend/.env.staging.example',
    'drip_backend/prisma/migrations/20261010120000_add_secure_order_policy/migration.sql',
    'drip_backend/prisma/migrations/20261010150000_add_historical_webhook_receipt/migration.sql',
    'drip_backend/prisma/schema.prisma',
    'drip_backend/src/app.ts',
    'drip_backend/src/controllers/guestOrderAccessController.ts',
    'drip_backend/src/controllers/orderController.ts',
    'drip_backend/src/controllers/stripeWebhookController.ts',
    'drip_backend/src/middlewares/guestOrderAccess.ts',
    'drip_backend/src/productionConfiguration.ts',
    'drip_backend/src/routes/navigationHandoffRoutes.ts',
    'drip_backend/src/routes/orderHandoffRoutes.ts',
    'drip_backend/src/runtimeConfiguration.ts',
    'drip_backend/src/server.ts',
    'drip_backend/src/services/guestOrderAccess.ts',
    'drip_backend/src/services/historicalWebhookReceipt.ts',
    'drip_backend/src/services/legacyReservation.ts',
    'drip_backend/src/services/navigationHandoff.ts',
    'drip_backend/src/services/orderHandoff.ts',
    'drip_backend/src/services/orderIdempotency.ts',
    'drip_backend/src/services/paymentService.ts',
    'drip_backend/src/services/reservationReconciliation.ts',
    'drip_backend/src/services/reservations.ts',
    'drip_backend/src/services/secureOrderPolicy.ts',
    'drip_backend/src/services/stripeClient.ts',
    'drip_backend/src/stripeApiVersion.ts',
    'drip_backend/tests/catalog.integration.test.cjs',
    'drip_backend/tests/contracts.test.cjs',
    'drip_backend/tests/guest-access.integration.test.cjs',
    'drip_backend/tests/handoff.integration.test.cjs',
    'drip_backend/tests/idempotency.integration.test.cjs',
    'drip_backend/tests/navigation.integration.test.cjs',
    'drip_backend/tests/payment.integration.test.cjs',
    'drip_backend/tests/reservations.integration.test.cjs',
    'drip_backend/tests/run-postgres-tests.cjs',
    'drip_backend/tests/run-tests.cjs',
    'drip_backend/tests/runtime-production.test.cjs',
    'drip_backend/tests/runtime-staging.test.cjs',
    'drip_backend/tests/secure-order-policy.integration.test.cjs'
)
git add -- $releaseFiles
if ($LASTEXITCODE -ne 0) { throw 'Selective add failed' }
$staged = @(git diff --cached --name-only)
if (Compare-Object ($releaseFiles | Sort-Object) ($staged | Sort-Object)) { throw 'Unexpected staged scope' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }
git diff --cached --stat
git diff --cached -- $releaseFiles
if ((Read-Host 'After secret and exact diff review, type APPROVE_COMMIT') -ne 'APPROVE_COMMIT') { throw 'Review not approved' }
git commit -m 'feat(backend): enforce secure order policy and quarantine historical webhooks'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git status --short

# Checkout
Set-Location -LiteralPath 'C:/Users/hp/Desktop/work/magic city/Magic_city_checkout_security'
if ((git branch --show-current).Trim() -ne 'staging/checkout') { throw 'Wrong branch' }
if (git diff --cached --name-only) { throw 'Index must be empty' }
$releaseFiles = @(
    'seamless_checkout_flow/scripts/run-tests.mjs',
    'seamless_checkout_flow/src/lib/secureCheckout.ts',
    'seamless_checkout_flow/tests/production-mode.test.ts'
)
git add -- $releaseFiles
if ($LASTEXITCODE -ne 0) { throw 'Selective add failed' }
$staged = @(git diff --cached --name-only)
if (Compare-Object ($releaseFiles | Sort-Object) ($staged | Sort-Object)) { throw 'Unexpected staged scope' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }
git diff --cached --stat
git diff --cached -- $releaseFiles
if ((Read-Host 'After secret and exact diff review, type APPROVE_COMMIT') -ne 'APPROVE_COMMIT') { throw 'Review not approved' }
git commit -m 'feat(checkout): support explicitly configured secure production handoff'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git status --short

# Store
Set-Location -LiteralPath 'C:/Users/hp/Desktop/work/magic city/Magic_city_git'
if ((git branch --show-current).Trim() -ne 'staging/store') { throw 'Wrong branch' }
if (git diff --cached --name-only) { throw 'Index must be empty' }
$releaseFiles = @(
    'drip_frontend/scripts/run-tests.mjs',
    'drip_frontend/src/lib/navigationHandoff.ts',
    'drip_frontend/tests/production-mode.test.ts'
)
git add -- $releaseFiles
if ($LASTEXITCODE -ne 0) { throw 'Selective add failed' }
$staged = @(git diff --cached --name-only)
if (Compare-Object ($releaseFiles | Sort-Object) ($staged | Sort-Object)) { throw 'Unexpected staged scope' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }
git diff --cached --stat
git diff --cached -- $releaseFiles
if ((Read-Host 'After secret and exact diff review, type APPROVE_COMMIT') -ne 'APPROVE_COMMIT') { throw 'Review not approved' }
git commit -m 'feat(store): support secure handoff and shipping in production mode'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git status --short

# Outillage et documentation
Set-Location -LiteralPath 'C:/Users/hp/Desktop/work/magic city/Magic_city_git'
if ((git branch --show-current).Trim() -ne 'staging/store') { throw 'Wrong branch' }
if (git diff --cached --name-only) { throw 'Index must be empty' }
$releaseFiles = @(
    'tools/staging/audits/2026-10-10-production-readiness/.gitignore',
    'tools/staging/audits/2026-10-10-production-readiness/BACKUP_AND_ROLLBACK.md',
    'tools/staging/audits/2026-10-10-production-readiness/CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql',
    'tools/staging/audits/2026-10-10-production-readiness/DATABASE_MIGRATION_PLAN.md',
    'tools/staging/audits/2026-10-10-production-readiness/DEPLOYMENT_RUNBOOK.md',
    'tools/staging/audits/2026-10-10-production-readiness/FINAL_COMMIT_MANIFEST.md',
    'tools/staging/audits/2026-10-10-production-readiness/FINAL_LOCAL_RELEASE_PREPARATION.md',
    'tools/staging/audits/2026-10-10-production-readiness/FULL_OFFLINE_E2E_VALIDATION.md',
    'tools/staging/audits/2026-10-10-production-readiness/GO_NO_GO_PRODUCTION.md',
    'tools/staging/audits/2026-10-10-production-readiness/HISTORICAL_WEBHOOK_REVIEW_RUNBOOK.md',
    'tools/staging/audits/2026-10-10-production-readiness/LEGACY_COMPATIBILITY_PRODUCTION_PLAN.md',
    'tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_FINAL_REVIEW.md',
    'tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql',
    'tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_READ_ONLY.sql',
    'tools/staging/audits/2026-10-10-production-readiness/PLAYWRIGHT_OFFLINE_E2E.md',
    'tools/staging/audits/2026-10-10-production-readiness/POSTGRES18_LOCAL_SQL_VALIDATION.md',
    'tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_18_AUDIT_ROLE_REVIEW.md',
    'tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_ENV_CHECKLIST.md',
    'tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_REMEDIATION_DESIGN.md',
    'tools/staging/audits/2026-10-10-production-readiness/PRODUCTION_REMEDIATION_REPORT.md',
    'tools/staging/audits/2026-10-10-production-readiness/REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql',
    'tools/staging/audits/2026-10-10-production-readiness/SECURE_ORDER_POLICY_IMPLEMENTATION.md',
    'tools/staging/audits/2026-10-10-production-readiness/SELECTIVE_COMMITS_REVIEW_ONLY.ps1',
    'tools/staging/audits/2026-10-10-production-readiness/STAGING_BACKUP_RESTORE_PLAN.md',
    'tools/staging/audits/2026-10-10-production-readiness/STAGING_BLOCKERS_RESOLUTION.md',
    'tools/staging/audits/2026-10-10-production-readiness/STAGING_COMMIT_CANDIDATES.md',
    'tools/staging/audits/2026-10-10-production-readiness/STAGING_GO_NO_GO.md',
    'tools/staging/audits/2026-10-10-production-readiness/STAGING_RELEASE_VALIDATION.md',
    'tools/staging/audits/2026-10-10-production-readiness/STAGING_TRANSITION_READ_ONLY.sql',
    'tools/staging/audits/2026-10-10-production-readiness/STRIPE_ENV_COMPATIBILITY.md',
    'tools/staging/audits/2026-10-10-production-readiness/STRIPE_LIVE_CHECKLIST.md',
    'tools/staging/audits/2026-10-10-production-readiness/STRIPE_OFFLINE_VALIDATION.md',
    'tools/staging/audits/2026-10-10-production-readiness/pg18-simulation/run-postgres18.cjs',
    'tools/staging/audits/2026-10-10-production-readiness/prepare-policy-rollback.cjs',
    'tools/staging/audits/2026-10-10-production-readiness/qualify-linux-rollback.cjs',
    'tools/staging/audits/2026-10-10-production-readiness/release-check.cjs',
    'tools/staging/audits/2026-10-10-production-readiness/rollback-linux.Dockerfile',
    'tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-pg18.cjs',
    'tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-regression-pg18.cjs',
    'tools/staging/backend.cjs',
    'tools/staging/final-flow-scenario.cjs',
    'tools/staging/frontend.mjs',
    'tools/staging/offline-stripe.cjs',
    'tools/staging/offline-stripe.test.cjs',
    'tools/staging/playwright-offline.cjs',
    'tools/staging/start.cjs',
    'tools/staging/validate-stripe-offline.cjs'
)
git add -- $releaseFiles
if ($LASTEXITCODE -ne 0) { throw 'Selective add failed' }
$staged = @(git diff --cached --name-only)
if (Compare-Object ($releaseFiles | Sort-Object) ($staged | Sort-Object)) { throw 'Unexpected staged scope' }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }
git diff --cached --stat
git diff --cached -- $releaseFiles
if ((Read-Host 'After secret and exact diff review, type APPROVE_COMMIT') -ne 'APPROVE_COMMIT') { throw 'Review not approved' }
git commit -m 'test(staging): qualify offline browser flow and policy-aware Linux rollback'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git status --short
