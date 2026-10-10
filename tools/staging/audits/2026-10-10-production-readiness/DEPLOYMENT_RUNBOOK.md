# Production deployment runbook - conditional, NOT AUTHORIZED

Status: BLOCKED / NO-GO. No command in this document was executed. Actual production domains, deployed SHAs and server identity require independent dashboard verification. Never substitute staging mode to enable production features.

## 1. Resolve source and operational gates

Preconditions: separately authorize production-mode changes identified in GO_NO_GO_PRODUCTION.md: secure navigation handoff, mandatory guest access with legacy/recovery plan, authoritative shipping, exact CORS origins. Preserve existing orders, grants, sessions and requests. Confirm reviewed production-mode builds and Linux validation, secret scanning/history review, operator ownership and monitoring.
Action: review the six audit reports; record verified Render/Netlify service IDs, domains, branch mappings, deployed SHAs, start/build commands and auto-deploy settings. No merge or configuration change is authorized by this audit.
Expected/verification: approved release SHAs and all blocking gates closed with evidence.
Stop: any unresolved gate, unreviewed automatic deployment or unknown production identity.
Rollback: no deployment occurred; retain the existing services and release.

## 2. Audit production DB and prepare intake window

Preconditions: separately authorized read-only access, exact magiccitydb_3334 and server identity independently matched to production Render configuration before every DB command. Credentials supplied privately through process environment, never chat or command-line URLs.
Action: execute the read-only audit in DATABASE_MIGRATION_PLAN.md; compare every migration checksum, required object definition, failed migration and legacy reservation/payment state. Inventory active sessions by persisted destination. Arrange a bounded new-order intake pause if needed; keep confirmation, existing Checkout routes and webhooks available.
Expected/verification: exact pending list established, no collisions, legacy handling and lock budget approved.
Stop: target mismatch, failed migration, schema drift, unexpected pending migration or no safe legacy strategy.
Rollback: end the read-only transaction with ROLLBACK; no schema change. Resume intake only under the approved operating plan.

## 3. Create and verify production backup

Preconditions: separate backup authorization, encrypted restricted destination outside Git, compatible pg_dump/pg_restore, sufficient space, verified identity and agreed recovery objectives.
Command: execute the guarded PowerShell/Node procedure in BACKUP_AND_ROLLBACK.md, unchanged after review. Record timestamp, size, SHA-256 and pg_restore --list result. Perform a separately authorized isolated restore rehearsal; never restore into production or staging.
Expected/verification: readable complete archive and demonstrated isolated recovery. Archive listing alone is insufficient recovery proof.
Stop: version mismatch, warnings requiring investigation, failed dump/list/hash, insufficient space or failed rehearsal.
Rollback: leave production unchanged; preserve diagnostic artifacts securely. Do not proceed without a usable backup.

## 4. Apply only reviewed pending Prisma migrations

Preconditions: backup and rehearsal approved; audited exact pending list; production identity revalidated immediately; pinned release and installed Prisma version; deployment/intake window approved separately. The local tree has 16 migrations, but the production pending list is currently UNKNOWN.
Command (future authorized operator, from the reviewed drip_backend directory):

```powershell
.\node_modules\.bin\prisma.cmd migrate deploy --schema=prisma/schema.prisma
```

DATABASE_URL must be set privately to the independently verified production target before this command; never load an ambiguous .env or paste a connection URL. This command applies ALL pending migrations, not a selected single directory. Do not execute until that complete list is approved.
Expected/verification: exit 0, all expected migrations completed, exact new objects and valid/ready indexes confirmed in a fresh read-only transaction; ROLLBACK final. Check NOT VALID constraints and legacy data separately.
Stop: nonzero exit, lock-budget breach or unexpected objects/history. No automatic retry, resolve, reset, seed or repair.
Rollback: keep additive schema and data; halt promotion and assess migration state read-only. Do not drop tables or restore the old database routinely. Partial DDL/failed history requires a separate recovery decision.

## 5. Deploy reviewed backend release

Preconditions: completed migration audit; production-mode blockers fixed and validated; production env checklist verified without values; LIVE key/webhook correspond to the correct Stripe account; retained historical callbacks and destinations remain served.
Dashboard action: select the verified production Render service and approved backend SHA only. Base directory drip_backend; build `npm ci --include=dev && npm run prisma:generate && npm run build`; start `npm start`. No migrate/seed/reset in startup or build. Recheck service identity before authorizing deployment.
Expected/verification: healthy listener, no configuration errors, correct release SHA, safe GET health/catalogue checks and CORS behavior; backend rejects unauthenticated order access according to the reviewed legacy plan. Verify logs do not expose credentials or sensitive URL fragments.
Stop: unhealthy service, wrong database/key mode, public guest exposure, unavailable historical callback or unsafe logging.
Rollback: use only a previously verified schema/protocol-compatible backend release. Historical backend d6107db is NOT an assumed safe rollback: it lacks persistent payment/reservation/guest protections. Preserve webhook processing and issued handoffs.

## 6. Validate webhook delivery compatibility

Preconditions: separate approval for any Stripe dashboard change; backend verified; current endpoint and subscriptions inspected first.
Dashboard action: verify LIVE endpoint POST /api/stripe/webhook on the independently verified production backend origin; events checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed. Verify the endpoint signing secret matches this destination privately. Do not create duplicate active destinations inadvertently.
Expected/verification: signed raw body accepted, amount/currency/order/attempt reconciliation and dedup work; observe authorized existing delivery results. Sending test/replayed events requires separate approval because it can write DB state.
Stop: signature errors, mode mismatch, reconciliation failures or duplicated processing.
Rollback: keep a compatible handler and delivery path; do not discard queued events or rewrite payment requests. Coordinate any endpoint rollback separately.

## 7. Deploy Checkout then Store as a coordinated release

Preconditions: production-mode frontend gates fixed; backend endpoints and webhook verified; all issued historical and new routes supported; trusted production origins confirmed. Deploy the receiving Checkout before enabling new Store handoff creation. Plan cache/version overlap explicitly.
Dashboard actions: verified Checkout Netlify site, base seamless_checkout_flow, approved SHA; then verified Store site, base drip_frontend, approved SHA. Build each with `npm ci && npm run build`, publish dist. MODE must be production after the authorized code fixes; `--mode staging` is not a production workaround. Use the exact frontend env lists in PRODUCTION_ENV_CHECKLIST.md; no server secrets in VITE variables.
Expected/verification: served build SHA/assets, SPA deep links, configured API/Store/Checkout origins, two-column mobile grids, same-tab handoff and return-to-primary-Store navigation. Existing in-flight sessions retain their persisted destinations and access grants.
Stop: wrong site/domain, missing endpoint, CSP/COOP breakage, stale assets mixing protocols or navigation to staging/localhost.
Rollback: restore only compatible frontend artifacts; stop new handoff issuance if necessary while retaining receiving routes and issued state. Never clear customer storage or turn an uncertain attempt into a new order.

## 8. Smoke tests and browser final-flow

Preconditions: named operator and separately approved production test scope. Default smoke checks are read-only; a LIVE purchase, order creation, refund or webhook replay needs explicit separate authorization.
Actions: inspect Home/Catalogo/Collezioni at 320/375/390/430/768/1280, filters/pagination, images and warnings; verify expired/invalid access without leaking identifiers. Under a separately authorized transaction test, cover Store -> same-tab handoff -> Stripe LIVE -> scoped confirmation -> Store, exact server shipping/discount total, reload/lost response and repeated confirmation without duplicate consumption. Staging TEST success does not prove LIVE configuration.
Expected/verification: backend-confirmed paid state only, exact-order authorized cart clearing, no credential leakage, normal Mirror simulation preserved and no generic checkout API.
Stop: wrong total/currency/mode, duplicate order/session/stock consumption, unauthorized access or stale wrong-order warning.
Rollback: pause new intake and use compatible application rollback; preserve paid orders, grants, reservations, sessions and webhooks. Refund only through a separately approved operational procedure.

## 9. Monitor and close release

Preconditions: agreed observation window, metrics and on-call owner.
Actions: inspect redacted application logs and Stripe delivery health; monitor 401/403, handoff failures, 5xx, session reconciliation, reservation expiry/stock and discount consistency, latency and client errors. Verify scheduling/distributed limits; do not assume a process-local limiter is distributed. Record deploy SHAs and audit evidence.
Expected/verification: stable metrics and no unresolved payment/privacy discrepancies throughout the agreed window.
Stop: any confidentiality breach, monetary inconsistency, stuck payments or capacity failure.
Rollback: compatible application rollback with intake control; schema stays additive. Database restoration is a separate incident decision with reconciliation of transactions since backup and explicit RPO impact.

## Downtime and rollback limits

REQUIRES MANUAL CHECK: duration cannot be estimated credibly without production size, lock contention and restore rehearsal. Ordinary CREATE INDEX can block writers; NOT VALID checks still constrain new writes. Additive migrations are not automatically reversible and old application code is not automatically safe. Backups lose post-snapshot transactions if restored. No automatic database rollback is proposed.
