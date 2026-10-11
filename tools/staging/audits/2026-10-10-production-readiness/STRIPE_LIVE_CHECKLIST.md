# Magic City Drip - production readiness audit, 2026-10-10

Evidence labels: VERIFIED = inspected local source or executed local check; REQUIRES MANUAL CHECK = external/runtime evidence unavailable; BLOCKED = prerequisite prevents safe promotion. No production/Stripe/DB connection, migration, commit, push, merge or deployment performed. Reports and generated validation artifacts only; application source unchanged.

## Source: VERIFIED; deployed configuration: REQUIRES MANUAL CHECK

POST <verified-production-api-origin>/api/stripe/webhook; current code treats exactly checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed. Select these events in the LIVE destination. Signing secret is the destination's LIVE whsec value, distinct from TEST. No dashboard action performed. express.raw(application/json) precedes express.json and constructEvent verifies stripe-signature.

Hosted Checkout uses server STRIPE_SECRET_KEY; no publishable key or browser Stripe SDK is required by this flow. Require actual sk_live key in production and sk_test in staging; prefix alone cannot prove account ownership/mode. Production runtime does not enforce live-only keys/events as staging enforces test-only: verify operational isolation and design stricter guards separately.

Session is created from persistent request and stable Stripe idempotency key. Total cents/currency come from Order; one aggregate line, metadata order_id/attempt_id. Real customer_email IS sent outside staging; privacy/email settings need manual review. Existing PaymentAttempt.request success/cancel URLs are persisted: environment changes do not migrate active attempts. Never rewrite old session URLs or re-create sessions to change destination.

Confirmation retrieves Stripe session and validates order/session/mode/amount/currency/attempt, then finalizes transactionally. PaymentFinalization and StripeEvent protect repeats and concurrent confirmation/webhook. Stock/remise reservations consume once; expiration reconciliation must be operationally verified. Legacy order without reservation is blocked by LEGACY_RESERVATION_REVIEW; inventory old in-flight orders before rollout.

No explicit refund webhook handling/automated refund workflow was identified in inspected payment routes. Define manual audited refund process and stock/remise policy before live operation; never infer refund reverses stock automatically. A cancel return is not payment proof or refund; do not immediately release reservations on browser cancel alone.

Manual gate: confirm LIVE account, restricted service ownership, actual active key mode, LIVE webhook URL/TLS/event selection/API version/signing secret, no TEST secrets on production, no LIVE secrets in staging, return templates with literal {ORDER_ID}/{CHECKOUT_SESSION_ID}, log/APM masking and delivery retries. Confirm no secrets under VITE_*. Validate with authorized operations only; this audit performs no LIVE transaction, creates no object and changes no settings.
