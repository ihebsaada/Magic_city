# Magic City Drip - production readiness audit, 2026-10-10

Evidence labels: VERIFIED = inspected local source or executed local check; REQUIRES MANUAL CHECK = external/runtime evidence unavailable; BLOCKED = prerequisite prevents safe promotion. No production/Stripe/DB connection, migration, commit, push, merge or deployment performed. Reports and generated validation artifacts only; application source unchanged.

## Remote audit: BLOCKED

PG_PRODUCTION_URL, PRODUCTION_DATABASE_HOST and DATABASE_URL absent. No connection attempted. Production target MUST be magiccitydb_3334; staging magiccity_db_staging is forbidden in this phase. Host must match a separately verified production Render database identity. Local configuration alone cannot prove that identity.

16 local migrations, expected chronological inventory:

- 20251202105927_init_ecommerce
- 20251204141208_add_option_names
- 20251205135947_add_orders
- 20251219131200_add_stripe_session_id
- 20260107132117_add_order_discount
- 20260121002114_add_admin_user
- 20260121141143_update_model_order
- 20260121141315_update_model_order
- 20260121192554_add_discount
- 20261003120000_add_order_idempotency
- 20261004120000_add_payment_attempts
- 20261004160000_add_stock_reservations
- 20261004190000_add_guest_order_access
- 20261004210000_product_read_indexes
- 20261004230000_add_order_handoff
- 20261005120000_add_navigation_handoff

Applied/pending/failed production counts and exact pending list: UNKNOWN. Do not infer them from staging's 15/16 migrations or old candidate schema.

## Authorized future read-only inspection

Before EVERY connection command, parse dedicated PG_PRODUCTION_URL locally; require postgres/postgresql protocol, decoded pathname exactly /magiccitydb_3334, hostname exactly PRODUCTION_DATABASE_HOST, no hash, verified TLS and trusted Render server identity. Never print URL/password or put URI in process arguments. Use dedicated least-privilege read-only credentials and PGOPTIONS=-c default_transaction_read_only=on.

Run queries in BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; verify current_database() before inspecting data; end with ROLLBACK. Inspect current_setting('server_version'), inet_server_addr()/inet_server_port() locally against dashboard identity without exporting credentials.

Queries: SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name; SELECT count(*) AS total,count(*) FILTER(WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS completed,count(*) FILTER(WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,count(*) FILTER(WHERE rolled_back_at IS NOT NULL) AS rolled_back FROM public._prisma_migrations; inspect failed/incomplete attempts separately (unfinished records are potential failed/interrupted records; inspect logs locally without publishing arbitrary logs). Compare names and SHA256 LF/CRLF SQL fingerprints; report extra remote entries and duplicate/rolled-back attempts, not just total.

Inspect pg_class/pg_namespace, pg_attribute, pg_constraint (including convalidated and definitions), pg_index (indisvalid/indisready plus pg_get_indexdef), enums and to_regclass for Order, PaymentAttempt, PaymentFinalization, StripeEvent, OrderReservation, StockReservationItem, GuestOrderAccess, GuestOrderRecovery, OrderHandoff, NavigationHandoff. There is NO model/table called StockReservation: code uses OrderReservation plus StockReservationItem.

## SQL compatibility

VERIFIED: seven new migrations are additive CREATE TABLE/INDEX plus reservedQuantity/reservedUses columns. No destructive DROP TABLE/COLUMN identified. ON DELETE clauses are FK policies, not DELETE statements. Reservation CHECK constraints are NOT VALID: existing bad rows are not validated merely by deployment; new writes are constrained. Catalog indexes are ordinary CREATE INDEX and can block writes. Additive does not mean zero-lock or compatibility with legacy writers.

OrderIdempotency depends on Order; PaymentAttempt/PaymentFinalization depend on Order; reservation tables depend on Order/Variant/Discount; guest tables precede handoff; NavigationHandoff depends on Order and GuestOrderAccess tokenHash. Preserve SQL/checksums exactly. NavigationHandoff adds 12 columns, PK, 3 RESTRICT FKs, creation-key unique index and order/date index. No existing order/grant backfill is provided.

## Future migration execution: NOT AUTHORIZED / NOT EXECUTED

After verified backup, restoration rehearsal, exact pending list, freeze/drain plan and explicit authorization, use installed pinned Prisma CLI from backend root:

    .\node_modules\.bin\prisma.cmd migrate deploy --schema=prisma/schema.prisma

DATABASE_URL must be supplied in the child process from the separately guarded production URL; never load a staging .env or use prisma migrate dev/reset/db push/resolve/seed/import. migrate deploy applies ALL pending migrations, not a single named migration. Any error: stop, preserve logs with secrets redacted, do not retry/resolve automatically, audit history and partial objects read-only. Success: read-only post-audit checksums/tables/indexes/constraints and approved unchanged aggregates. Do not drop additive objects on application rollback.
