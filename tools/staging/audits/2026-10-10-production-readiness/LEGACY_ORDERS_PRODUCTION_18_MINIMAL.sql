\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT 1 / CASE WHEN current_database()='magiccitydb_3334' AND session_user='magiccity_prod_audit' AND current_user='magiccity_prod_audit' AND current_setting('server_version_num')::int/10000=18 AND current_setting('transaction_read_only')='on' AND current_setting('default_transaction_read_only')='on' THEN 1 ELSE 0 END AS identity_read_only_guard;
SELECT current_database() AS database,current_user AS audit_role,current_setting('server_version') AS server_version,current_setting('transaction_read_only') AS transaction_read_only;
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND(NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit)) AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) THEN 1 ELSE 0 END AS role_attributes_guard;
SELECT 1 / CASE WHEN NOT has_database_privilege(current_database(),'CREATE,TEMPORARY') AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' AND has_schema_privilege(oid,'CREATE')) AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE CASE WHEN n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f') THEN (has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(c.oid,'INSERT,UPDATE,REFERENCES')) ELSE false END) AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE CASE WHEN c.relkind='S' AND n.nspname !~ '^pg_' THEN has_sequence_privilege(c.oid,'USAGE,UPDATE') ELSE false END) THEN 1 ELSE 0 END AS effective_no_write_guard;
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND has_function_privilege(p.oid,'EXECUTE')) THEN 1 ELSE 0 END AS no_custom_security_definer_guard;
SELECT 1 / CASE WHEN NOT EXISTS(
 SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE CASE WHEN a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' THEN has_column_privilege('magiccity_prod_audit',c.oid,a.attnum,'SELECT') ELSE false END
 AND NOT(n.nspname='public' AND ((c.relname='Order' AND a.attname=ANY(ARRAY['id','orderNumber','status','paymentStatus','total','currency','stripeSessionId','sumupCheckoutId','sumupPaymentId'])) OR(c.relname='OrderItem' AND a.attname='orderId') OR(c.relname='_prisma_migrations' AND a.attname=ANY(ARRAY['migration_name','checksum','finished_at','rolled_back_at']))))) THEN 1 ELSE 0 END AS no_excess_read_guard;

SELECT has_database_privilege(current_database(),'CONNECT') AS can_connect,has_schema_privilege('public','USAGE') AS can_use_public;
SELECT c.relname,a.attname,has_column_privilege(c.oid,a.attnum,'SELECT') AS can_select FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND c.relname IN ('Order','OrderItem','_prisma_migrations') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
-- RLS could conceal records. Reject enabled RLS rather than bypassing it.
SELECT 1 / CASE WHEN count(*)=3 AND NOT bool_or(c.relrowsecurity OR c.relforcerowsecurity) THEN 1 ELSE 0 END AS complete_read_scope_guard
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('Order','OrderItem','_prisma_migrations') AND c.relkind='r';
SELECT name,to_regclass(format('public.%I',name)) IS NOT NULL AS present FROM(VALUES('PaymentAttempt'),('PaymentFinalization'),('StripeEvent'),('GuestOrderAccess'),('OrderReservation'),('StockReservationItem'),('OrderHandoff'),('NavigationHandoff')) t(name);
-- These additive tables are confirmed absent: unexpected presence requires a revised ACL/inventory.
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('PaymentAttempt','PaymentFinalization','StripeEvent','GuestOrderAccess','GuestOrderRecovery','OrderReservation','StockReservationItem','OrderHandoff','NavigationHandoff')) THEN 1 ELSE 0 END AS confirmed_historical_schema_guard;
SELECT count(*) AS total_orders,count(*) FILTER(WHERE "orderNumber" BETWEEN 1 AND 12) AS in_admin_range,count(*) FILTER(WHERE "orderNumber" IS NULL OR "orderNumber" NOT BETWEEN 1 AND 12) AS outside_admin_range FROM public."Order";
SELECT "paymentStatus",status,currency,count("orderNumber") AS orders FROM public."Order" GROUP BY 1,2,3 ORDER BY 1,2,3;
SELECT n.number AS admin_number,count(o."orderNumber") AS database_matches FROM generate_series(1,12) n(number) LEFT JOIN public."Order" o ON o."orderNumber"=n.number GROUP BY n.number ORDER BY n.number;
SELECT "orderNumber",status,"paymentStatus",total,currency,
 CASE WHEN nullif("stripeSessionId",'') IS NULL THEN 'NONE' WHEN "stripeSessionId" ~ '^cs_test_' THEN 'TEST_PREFIX_HINT' WHEN "stripeSessionId" ~ '^cs_live_' THEN 'LIVE_PREFIX_HINT_NOT_PROOF' ELSE 'UNKNOWN_FORMAT' END AS stripe_reference_class,
 nullif("sumupCheckoutId",'') IS NOT NULL AS has_sumup_checkout,nullif("sumupPaymentId",'') IS NOT NULL AS has_sumup_payment
FROM public."Order" WHERE "orderNumber" BETWEEN 1 AND 12 ORDER BY "orderNumber";
SELECT CASE WHEN nullif("stripeSessionId",'') IS NULL THEN 'NONE' WHEN "stripeSessionId" ~ '^cs_test_' THEN 'TEST_PREFIX_HINT' WHEN "stripeSessionId" ~ '^cs_live_' THEN 'LIVE_PREFIX_HINT_NOT_PROOF' ELSE 'UNKNOWN_FORMAT' END AS stripe_reference_class,"paymentStatus",count("orderNumber") AS orders FROM public."Order" GROUP BY 1,2 ORDER BY 1,2;
SELECT o."orderNumber",count(i."orderId") AS item_rows FROM public."Order" o LEFT JOIN public."OrderItem" i ON i."orderId"=o.id GROUP BY o.id,o."orderNumber" ORDER BY o."orderNumber";
SELECT count(i."orderId") AS orphan_item_rows FROM public."OrderItem" i LEFT JOIN public."Order" o ON o.id=i."orderId" WHERE o.id IS NULL;
SELECT count(migration_name) AS migration_rows,count(*) FILTER(WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS completed,count(*) FILTER(WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,count(*) FILTER(WHERE rolled_back_at IS NOT NULL) AS rolled_back FROM public._prisma_migrations;
SELECT migration_name,checksum,finished_at IS NOT NULL AS completed,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY migration_name;
ROLLBACK;
