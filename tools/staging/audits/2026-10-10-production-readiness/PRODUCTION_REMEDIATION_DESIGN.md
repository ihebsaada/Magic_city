# Production remediation design - 2026-10-10

Six readiness reports read before changes. Scope: local source/tests/docs only, no DB/migration/Stripe/service action.

## Configuration and activation

Reuse DEPLOYMENT_ENV=production, NODE_ENV=production, VITE_NAVIGATION_HANDOFF_ENABLED and existing API/origin variables in frontends. Backend currently only has STAGING_* origins and no production strict configuration. Introduce deliberately symmetrical PRODUCTION_DATABASE_HOST, PRODUCTION_STORE_ORIGIN, PRODUCTION_CHECKOUT_ORIGIN, PRODUCTION_API_ORIGIN and backend NAVIGATION_HANDOFF_ENABLED (exact true/false). These new names are needed to configure the existing createApp allowedOrigins/handoffOrigins options rather than hardcode deployment domains. NAVIGATION_HANDOFF_SECRET remains the existing dedicated secret. No staging variables authorize production.

Production configuration must verify exact magiccitydb_3334, independently configured host, TLS, live-key prefix, signing secret shape, JWT/ticket secret length and separation, exact HTTPS origins, Checkout destination and return templates. Reject staging settings/hosts, API-version overrides, missing explicit mode and ambiguous NODE_ENV=production without DEPLOYMENT_ENV. Same source entry server validates before constructing clients. Mandatory guest access and shipping are independent of the navigation feature switch; stopping new handoff entry must not create anonymous access or change old amounts. Issued ticket redemption stays available when creation switch is off.

Frontend flag works in MODE production or staging only; DEV simulator/common-origin gates remain untouched. Shipping estimate follows business rule independently of navigation flag. Backend shippingEnabled becomes its own app option, preserving staging's existing behavior and nonproduction test defaults. Frozen historical requests/order snapshots never recalculated.

## Legacy/recovery boundary - BLOCKED

Existing orderId/sessionId alone is not ownership proof. Do not provision grants from those values or invent emails/reservations. Recovery primitive needs verified delivery transport plus recipient UI, consent/privacy/rate limits and end-to-end tests. Historical orders without reservations require independent operational review, not empty reservations. Production identity/history/active session inventory unavailable in this mission.

Therefore do not silently enable a breaking rollout. The production server explicitly refuses startup before Prisma/Stripe import with PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED. There is no environment bypass. The reviewed production app options can be exercised using mock/in-memory tests; mandatory guest authorization is enforced there. Removing this stop requires a separately reviewed implementation/verified legacy strategy. Staging startup remains operational. This is a partial remediation, not a deployable production release.

## Deployment implications

16 existing migrations remain unchanged; no new migration needed for configuration. Production applied/pending list unknown. Keep existing grants, handoffs, PaymentAttempts, return destinations and totals. After legacy blocker resolved: audited production DB -> separately authorized backup/rehearsal -> reviewed pending migrations -> compatible backend -> Checkout receiver -> Store issuer. Preserve confirmation/webhooks and ticket redemption during rollout/rollback. Never deploy historical unprotected backend as a blind rollback.
