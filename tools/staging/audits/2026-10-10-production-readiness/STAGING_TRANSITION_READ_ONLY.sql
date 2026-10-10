\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT 1 / CASE WHEN current_database()='magiccity_db_staging'
 AND current_setting('transaction_read_only')='on' THEN 1 ELSE 0 END AS target_guard;
SELECT current_database(), current_setting('server_version'), current_setting('transaction_read_only');
SELECT count(*) AS total,
 count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS completed,
 count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back,
 count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished
FROM public._prisma_migrations;
SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,
 rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name;
SELECT status,"paymentStatus",currency,count(*) AS orders,sum(total) AS frozen_total
FROM public."Order" GROUP BY status,"paymentStatus",currency ORDER BY 1,2,3;
-- No raw payment identifiers, PII, tokens or grant hashes are emitted.
SELECT count(*) AS orders,
 count(*) FILTER (WHERE "stripeSessionId" LIKE 'cs_test_%') AS test_reference_hints,
 count(*) FILTER (WHERE "stripeSessionId" LIKE 'cs_live_%') AS live_reference_hints,
 count(*) FILTER (WHERE "stripeSessionId" IS NOT NULL AND "stripeSessionId" NOT LIKE 'cs_test_%' AND "stripeSessionId" NOT LIKE 'cs_live_%') AS other_references
FROM public."Order";
SELECT name,to_regclass(format('public.%I',name)) IS NOT NULL AS present
FROM (VALUES ('SecureOrderPolicy'),('PaymentAttempt'),('GuestOrderAccess'),('OrderReservation'),('StockReservationItem'),('OrderHandoff'),('NavigationHandoff')) AS expected(name);
-- Optional relations: absent is UNKNOWN, never silently interpreted as zero.
SELECT format('SELECT %L AS relation, count(*) AS rows FROM public.%I',name,name)
FROM (VALUES ('SecureOrderPolicy'),('PaymentAttempt'),('GuestOrderAccess'),('OrderReservation'),('StockReservationItem'),('OrderHandoff'),('NavigationHandoff')) AS expected(name)
WHERE to_regclass(format('public.%I',name)) IS NOT NULL
\gexec
SELECT 'SELECT CASE WHEN p."orderId" IS NULL THEN ''historical'' ELSE ''registered'' END AS classification,o.status,o."paymentStatus",count(*) FROM public."Order" o LEFT JOIN public."SecureOrderPolicy" p ON p."orderId"=o.id GROUP BY 1,2,3'
WHERE to_regclass('public."SecureOrderPolicy"') IS NOT NULL
\gexec
SELECT 'SELECT ''SecureOrderPolicy absent: all existing orders lack registration; transition review required'' AS limitation'
WHERE to_regclass('public."SecureOrderPolicy"') IS NULL
\gexec
SELECT format('SELECT %L AS relation,state,count(*) AS rows FROM public.%I GROUP BY state',name,name)
FROM (VALUES ('PaymentAttempt'),('OrderReservation')) AS expected(name)
WHERE to_regclass(format('public.%I',name)) IS NOT NULL
\gexec
SELECT 'SELECT ''GuestOrderAccess'' AS relation,count(*) FILTER (WHERE "revokedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP) AS active,count(*) FILTER (WHERE "orderId" IS NULL) AS unbound FROM public."GuestOrderAccess"'
WHERE to_regclass('public."GuestOrderAccess"') IS NOT NULL
\gexec
SELECT 'SELECT ''OrderReservation'' AS relation,state,"expiresAt">CURRENT_TIMESTAMP AS unexpired,count(*) FROM public."OrderReservation" GROUP BY state,3'
WHERE to_regclass('public."OrderReservation"') IS NOT NULL
\gexec
-- Per-order aliases are admin order numbers, never internal IDs or customer data.
SELECT "orderNumber",status,"paymentStatus",currency,total,
 "stripeSessionId" IS NOT NULL AS stripe_reference,
 "stripeSessionId" LIKE 'cs_live_%' AS unexpected_live_hint,
 "sumupCheckoutId" IS NOT NULL OR "sumupPaymentId" IS NOT NULL AS sumup_reference
FROM public."Order" ORDER BY "orderNumber";
SELECT format('SELECT %L AS relation,o."orderNumber",count(d."orderId") AS dependencies FROM public."Order" o LEFT JOIN public.%I d ON d."orderId"=o.id GROUP BY o."orderNumber" ORDER BY o."orderNumber"',name,name)
FROM (VALUES ('PaymentAttempt'),('GuestOrderAccess'),('OrderReservation'),('StockReservationItem'),('NavigationHandoff')) AS expected(name)
WHERE to_regclass(format('public.%I',name)) IS NOT NULL
\gexec
SELECT 'SELECT state,count(*) AS attempts,count(*) FILTER (WHERE "sessionId" LIKE ''cs_live_%'') AS unexpected_live_hints FROM public."PaymentAttempt" GROUP BY state'
WHERE to_regclass('public."PaymentAttempt"') IS NOT NULL
\gexec
SELECT 'SELECT "reviewState",severity,livemode,count(*) AS alerts,min("createdAt") AS first_alert,max("createdAt") AS last_alert FROM public."HistoricalWebhookReceipt" GROUP BY 1,2,3'
WHERE to_regclass('public."HistoricalWebhookReceipt"') IS NOT NULL
\gexec
SELECT format('SELECT %L AS relation,count(*) AS orphan_dependencies FROM public.%I d LEFT JOIN public."Order" o ON o.id=d."orderId" WHERE d."orderId" IS NOT NULL AND o.id IS NULL',name,name)
FROM (VALUES ('PaymentAttempt'),('PaymentFinalization'),('GuestOrderAccess'),('GuestOrderRecovery'),('OrderReservation'),('StockReservationItem'),('NavigationHandoff'),('SecureOrderPolicy')) AS expected(name)
WHERE to_regclass(format('public.%I',name)) IS NOT NULL
\gexec
SELECT 'SELECT o."orderNumber",count(h.id) AS manual_handoffs FROM public."Order" o LEFT JOIN public."OrderHandoff" h ON h."expectedOrderId"=o.id GROUP BY o."orderNumber" ORDER BY o."orderNumber"'
WHERE to_regclass('public."OrderHandoff"') IS NOT NULL
\gexec
SELECT 'SELECT o."orderNumber",a.state,count(*) FROM public."PaymentAttempt" a JOIN public."Order" o ON o.id=a."orderId" GROUP BY 1,2 ORDER BY 1,2'
WHERE to_regclass('public."PaymentAttempt"') IS NOT NULL
\gexec
ROLLBACK;
