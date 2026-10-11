\set ON_ERROR_STOP on
\pset pager off
-- ADMINISTRATION WRITES. HUMAN APPROVAL REQUIRED. NOT EXECUTED.
BEGIN;
SELECT 1 / CASE WHEN current_database()='magiccitydb_3334' AND current_setting('server_version_num')::int/10000=18 THEN 1 ELSE 0 END AS target_guard;
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='magiccity_prod_audit') THEN 1 ELSE 0 END AS new_role_guard;
SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolcreaterole OR rolsuper)) THEN 1 ELSE 0 END AS role_creation_authority_guard;
CREATE ROLE magiccity_prod_audit NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD NULL;
SELECT format('ALTER ROLE magiccity_prod_audit VALID UNTIL %L',transaction_timestamp()+interval '24 hours') \gexec
ALTER ROLE magiccity_prod_audit SET default_transaction_read_only=on;
ALTER ROLE magiccity_prod_audit SET statement_timeout='30s';
ALTER ROLE magiccity_prod_audit SET idle_in_transaction_session_timeout='60s';
ALTER ROLE magiccity_prod_audit SET search_path=pg_catalog;
GRANT CONNECT ON DATABASE magiccitydb_3334 TO magiccity_prod_audit;
GRANT USAGE ON SCHEMA public TO magiccity_prod_audit;
GRANT SELECT (id,"orderNumber",status,"paymentStatus",total,currency,"stripeSessionId","sumupCheckoutId","sumupPaymentId") ON public."Order" TO magiccity_prod_audit;
GRANT SELECT ("orderId") ON public."OrderItem" TO magiccity_prod_audit;
GRANT SELECT (migration_name,checksum,finished_at,rolled_back_at) ON public._prisma_migrations TO magiccity_prod_audit;
-- No global SELECT, sequence rights, memberships or default privileges granted.
-- ACLs are additive: REVOKE FROM this role cannot override PUBLIC privileges.
-- Stop and ROLLBACK if PUBLIC/other grants violate the minimal profile.
SELECT 1 / CASE WHEN NOT has_database_privilege('magiccity_prod_audit',current_database(),'CREATE,TEMPORARY')
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND has_schema_privilege('magiccity_prod_audit',n.oid,'CREATE'))
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE CASE WHEN n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f') THEN (has_table_privilege('magiccity_prod_audit',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege('magiccity_prod_audit',c.oid,'INSERT,UPDATE,REFERENCES')) ELSE false END)
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE CASE WHEN c.relkind='S' AND n.nspname !~ '^pg_' THEN has_sequence_privilege('magiccity_prod_audit',c.oid,'USAGE,UPDATE') ELSE false END)
 AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='magiccity_prod_audit')
 THEN 1 ELSE 0 END AS no_effective_write_or_membership_guard;
SELECT 1 / CASE WHEN NOT EXISTS(
 SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE CASE WHEN a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' THEN has_column_privilege('magiccity_prod_audit',c.oid,a.attnum,'SELECT') ELSE false END
 AND NOT(n.nspname='public' AND ((c.relname='Order' AND a.attname=ANY(ARRAY['id','orderNumber','status','paymentStatus','total','currency','stripeSessionId','sumupCheckoutId','sumupPaymentId'])) OR(c.relname='OrderItem' AND a.attname='orderId') OR(c.relname='_prisma_migrations' AND a.attname=ANY(ARRAY['migration_name','checksum','finished_at','rolled_back_at']))))) THEN 1 ELSE 0 END AS no_excess_read_guard;
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND has_function_privilege('magiccity_prod_audit',p.oid,'EXECUTE')) THEN 1 ELSE 0 END AS no_custom_security_definer_guard;
COMMIT;
-- After separately approved successful setup: use interactive psql \password magiccity_prod_audit.
-- No password supplied in this file. Validate authentication policy before setting it.
-- Only AFTER approved authentication-policy verification and hidden password assignment:
-- ALTER ROLE magiccity_prod_audit LOGIN; -- separate approved admin write, correct DB required
