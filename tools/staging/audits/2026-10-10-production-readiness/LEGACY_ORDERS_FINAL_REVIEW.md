# Legacy orders final review - 2026-10-10

## Verdict: UNKNOWN inventory / NO-GO to remove startup blocker

PG_PRODUCTION_URL=MISSING; PRODUCTION_DATABASE_HOST=MISSING in the agent process. No production connection attempted. No credentials requested or printed. Production count/distribution, whether #1-#12 exhaust the DB, payment modes, migration state and dependency records remain UNVERIFIED. The admin observation is user-reported, not DB proof. No application change, startup-blocker removal, migration, commit, push, deployment or Stripe operation.

## Prepared inventory

LEGACY_ORDERS_READ_ONLY.sql is a psql script (uses psql meta-commands, not directly a GUI SQL editor script). It starts REPEATABLE READ READ ONLY, requires current_database() exactly magiccitydb_3334 with an error on mismatch, uses bounded statement timeout, and ends ROLLBACK. ON_ERROR_STOP stops on any privilege/schema/query error. No DDL, DML, temp tables or functions created. gexec executes only generated SELECTs from fixed templates, conditional on optional relation presence. Absent tables are reported absent, NOT interpreted as zero dependencies. Actual remote column drift stops dependent queries for review; never suppress errors as empty results.

Outputs: server version/database/read-only flag; expected table/column presence; total orders; status/payment/currency distribution; exact matches for admin-reported numbers 1-12; all order numbers/totals/state and Stripe-prefix hints (no customer data, raw session references, hashes, secrets or payment request JSON); dependency totals/per-order counts/orphans; attempts by state/reference prefix; active grants; reservations by state/expiry; stock links; session disagreement review; migration names/checksums/state. StockReservation is NOT a model/table in current source: inspect OrderReservation and StockReservationItem. SumUp references are also flagged so non-Stripe payments are not silently ignored.

The current local admin controller queries all Order records without take/skip/filter, but this proves neither the deployed admin/backend version nor its connected DB. UI filters, caching, environment mismatch or another deployed contract remain possible. DB count must be exactly 12, numbers 1-12 must each match once, and no other records may exist to establish the reported set is complete. Numbers alone do not prove orders are tests. Compare statuses/currency/frozen totals privately with the actual admin, using order-number aliases and no PII exports.

## Guarded Windows PowerShell execution - NOT RUN

An authorized operator must independently match the DB host to the production Render service before using this command. Supply PG_PRODUCTION_URL and PRODUCTION_DATABASE_HOST privately in the process, never chat. PG_BIN is the installed psql directory. The audit-only PRODUCTION_SERVER_IDENTITY_VERIFIED=YES is an operator attestation AFTER independent verification, not a substitute for verification and not a backend configuration variable. Use a least-privilege read-only role. Never load an ambiguous production/staging .env. The script is not a backup or migration.

From Magic_city_git, execute this Node script using a PowerShell single-quoted here-string piped to node:

```javascript
const fs=require('fs'),path=require('path'),cp=require('child_process');
try {
 const raw=process.env.PG_PRODUCTION_URL,host=process.env.PRODUCTION_DATABASE_HOST;
 if(!raw||!host||process.env.PRODUCTION_SERVER_IDENTITY_VERIFIED!=='YES')throw Error();
 const u=new URL(raw),tls=u.searchParams.get('sslmode');
 if(!['postgres:','postgresql:'].includes(u.protocol)||decodeURIComponent(u.pathname)!=='/magiccitydb_3334'||u.hostname!==host||/staging/i.test(host)||u.hash||!['require','verify-full'].includes(tls))throw Error();
 const bin=process.env.PG_BIN;if(!bin||!path.isAbsolute(bin))throw Error();
 const sql=fs.readFileSync('tools/staging/audits/2026-10-10-production-readiness/LEGACY_ORDERS_READ_ONLY.sql','utf8');
 const env={};for(const k of ['PATH','Path','SystemRoot','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
 Object.assign(env,{PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:'magiccitydb_3334',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:tls,PGCONNECT_TIMEOUT:'15',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=30000'});
 // Revalidate the dedicated target immediately before the sole connection command.
 const again=new URL(process.env.PG_PRODUCTION_URL);
 if(decodeURIComponent(again.pathname)!=='/magiccitydb_3334'||again.hostname!==host)throw Error();
 const r=cp.spawnSync(path.join(bin,'psql.exe'),['-X','-w','-v','ON_ERROR_STOP=1','-f','-'],{env,input:sql,encoding:'utf8',maxBuffer:8e6});
 if(r.status!==0)throw Error();
 console.log(r.stdout); // Inventory is deliberately free of credentials/PII/raw session references.
} catch {console.error('AUDIT_STOPPED: identity, access, schema or query failure. Do not retry automatically; inspect errors privately with redaction.');process.exitCode=1;}
```

No URL in CLI arguments or output. Script ignores URI connection extras except explicitly validated TLS/port/host/user/database, avoiding service overrides. On failure, connection closes and any open read-only transaction rolls back. Do not publish arbitrary psql stderr; stop and inspect privately if schema drift occurs. This procedure has not been executed or validated against the production schema.

## LIVE payment classification

DB PAID/REFUNDED, PaymentAttempt.state, a finalization row and cs_live_/cs_test_ prefixes are evidence hints only. None proves current Stripe session/payment mode/status. No stored livemode field exists in inspected models. Missing attempts are possible for historical sessions; a session reference may exist only in Order. Missing references cannot exclude a session created before a lost persistence response. SumUp or external/manual payments also require review.

Required manual read-only review in the independently verified correct Stripe account: inspect BOTH LIVE and TEST histories for the full relevant time range, all order numbers/metadata, known sessions and any unlinked sessions/payment intents. Record only order alias, livemode, session status, payment_status, exact amount/currency, payment intent/charge success/refund/dispute state and whether any session remains open or async payment unresolved. Do not replay events, expire sessions, pay or refund during review. Absence of LIVE rows in a DB prefix query alone is NOT proof no LIVE payments exist.

No Stripe Dashboard access was performed. Active/completed LIVE payments: UNKNOWN. Test-order classification requires business attestation backed by DB and payment-provider evidence, not the number 12 or admin label.

## Conditional safe handling if all historical orders are confirmed tests

Preserve records, IDs/order numbers, totals/currency, payment snapshots, references and all dependent records unchanged. Keep historical admin access behind existing admin authorization. Do not mint grants from orderId/email/sessionId, backfill dummy reservations, reset payment state or expose legacy records through public guest endpoints. Do not create Stripe sessions for historical test orders with a LIVE key.

Require an active exact-order grant for every new guest read/pay/confirmation. New orders obtain prepared grants through the existing secure flow; handoff recipient gets its own grant; preserve idempotency/reservations/cart revision checks. Historical no-grant records remain admin-only. Preserve old callback routes, but never allow them to act as an ownership credential. Old TEST callbacks cannot be routed through a LIVE-only handler to obtain a false success; any still-active test delivery/session needs a separately reviewed retirement/isolation plan, not an unapproved provider action.

Do not silently strand real customers: obtain explicit reviewed classification of ALL legacy records and provider activity. If any genuine legacy customer order, unresolved LIVE payment, active return/webhook obligation, unexplained dependency/orphan or unknown classification exists, STOP this legacy exemption. Verified recovery/reconciliation remains required for affected cases.

## Can production startup proceed without legacy customer recovery?

CONDITIONALLY YES in design if exhaustive DB/provider review establishes no genuine legacy customer access obligations, no unresolved LIVE payments, and business explicitly approves historical-test records remaining admin-only. Recovery for legacy tests would then not be a prerequisite for NEW secured purchases. This does not eliminate a recovery policy for new real customers who lose/expire grants; clearly define supported assistance/verified recovery before launch and do not promise an unavailable recovery service.

CURRENTLY NO: evidence is unavailable, so the startup blocker remains untouched. Removing it requires a separately authorized reviewed code change after evidence, compatibility/callback obligations and business sign-off; not a configuration toggle. Other production gates (DB migration audit/backup, exact origins, LIVE configuration, operations and browser checks) remain independently required. No deletion, migration or data rewrite is needed merely to keep historical tests admin-only.

```text
DB_COUNT=UNKNOWN
ADMIN_SET_EQUALS_DATABASE=UNKNOWN
HISTORICAL_ORDERS_CONFIRMED_TEST=UNKNOWN
ACTIVE_OR_COMPLETED_LIVE_PAYMENTS=UNKNOWN
DEPENDENCIES_REVIEWED_REMOTELY=NO
PRODUCTION_STARTUP_SAFE_NOW=NO
STARTUP_BLOCKER_REMOVED=NO
PRODUCTION_CHANGES_PERFORMED=NO
```
