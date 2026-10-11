\set ON_ERROR_STOP on
-- ADMINISTRATION WRITES. HUMAN APPROVAL REQUIRED. NOT EXECUTED.
BEGIN;
SELECT 1 / CASE WHEN current_database()='magiccitydb_3334' AND current_setting('server_version_num')::int/10000=18 THEN 1 ELSE 0 END AS target_guard;
ALTER ROLE magiccity_prod_audit NOLOGIN PASSWORD NULL CONNECTION LIMIT 0;
REVOKE SELECT (id,"orderNumber",status,"paymentStatus",total,currency,"stripeSessionId","sumupCheckoutId","sumupPaymentId") ON public."Order" FROM magiccity_prod_audit;
REVOKE SELECT ("orderId") ON public."OrderItem" FROM magiccity_prod_audit;
REVOKE SELECT (migration_name,checksum,finished_at,rolled_back_at) ON public._prisma_migrations FROM magiccity_prod_audit;
REVOKE USAGE ON SCHEMA public FROM magiccity_prod_audit;
REVOKE CONNECT ON DATABASE magiccitydb_3334 FROM magiccity_prod_audit;
COMMIT;
SELECT count(*) AS remaining_audit_sessions FROM pg_stat_activity WHERE usename='magiccity_prod_audit';
-- NOLOGIN does not end existing sessions. Close them normally and recheck zero.
-- Do not terminate sessions automatically. No DROP ROLE / DROP OWNED included.
