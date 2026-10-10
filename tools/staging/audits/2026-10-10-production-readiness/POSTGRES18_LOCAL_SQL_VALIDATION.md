# PostgreSQL 18 isolated SQL validation - 2026-10-10

## Final result: 30/30 PASS in synthetic local simulation

Actual server: 18.6 (Debian 18.6-1.pgdg13+2). Local Docker named-pipe daemon, official postgres:18 image sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722. Container network=none, no published ports, data exclusively tmpfs. Connections used docker exec -> 127.0.0.1 INSIDE that container. Database deliberately named magiccitydb_3334 to exercise exact-name guards; it was NOT Render. Container removed after every run, including failures. No image/volume/network pruning or other container alteration.

No production credentials inherited: runner constructs a whitelisted environment, generates random ephemeral synthetic passwords, and pins the local Docker endpoint. No Render/Stripe/production connection. No application file changed by this task, no migration, commit, push or deployment. Preexisting application diffs and docs/ preserved. No production role was created or changed.

## Corrections discovered by real execution

Initial hardened-ACL setup FAILED: has_sequence_privilege was evaluated on pg_toast_16385 (not a sequence). SQL AND predicates do not guarantee evaluation order. Corrected CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql and LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql: CASE guards now contain privilege functions and restrict evaluation to the applicable object kind/schema. Same treatment applied to table and column privilege checks. Security predicates were preserved, not relaxed.

An intermediate correction had a parenthesis error, detected and fixed during the local rerun. Final scripts subsequently completed the entire cycle. Original failure evidence retained in pg18-simulation/FIRST_PASS_RESULTS.json and FIRST_PASS_ERROR.txt. REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql needed no correction.

## Fixture and limitations

12 fictitious orders (#1-#12), six PAID and six PENDING, EUR total 14.90 each; 24 items; nine completed SYNTHETIC migration-history rows; PII/password/log sentinels. Eleven fake test-prefix references and one deliberately fake live-prefix reference exercise classifications. These are NOT real Stripe sessions or payments. Confirmed historical table names were reproduced; ancillary catalogue tables use minimal placeholder columns. Order/payment statuses are text in this fixture, not production enums; real enum behavior/migration SQL/provider extensions/data not certified by this test. No Prisma migrations applied.

The inventory returned 12 orders, correct per-order item counts, zero orphan items, nine completed synthetic history rows, and final ROLLBACK. Output contained none of the PII/password/log sentinels or raw synthetic payment references. Orders remained count=12, total sum=178.80 after all negative tests. This does not establish any production count or classification.

Synthetic password assignment used a locally computed SCRAM-SHA-256 verifier delivered through stdin; no plaintext password in SQL text, process arguments or evidence. Actual TCP/SCRAM connection with the audit role succeeded. Human interactive psql password entry remains an operational step to validate on the approved workstation.

## Actual test results

| Test | Result | Expected behavior |
|---|---|---|
|default_PUBLIC_TEMP_setup_refused|PASS|refusal (exit 3)|
|failed_setup_role_rolled_back|PASS|success (exit 0)|
|hardened_LOCAL_ACL_setup|PASS|success (exit 0)|
|SCRAM_password_assignment_LOGIN_activation|PASS|success (exit 0)|
|audit_inventory_complete|PASS|success (exit 0)|
|inventory_no_PII_or_raw_payment_reference|PASS|success (exit 0)|
|wrong_role_inventory_refused|PASS|refusal (exit 3)|
|wrong_database_inventory_refused|PASS|refusal (exit 3)|
|default_read_only_insert_refused|PASS|refusal (exit 3)|
|ACL_INSERT_refused_after_readonly_override|PASS|refusal (exit 3)|
|ACL_UPDATE_refused_after_readonly_override|PASS|refusal (exit 3)|
|ACL_DELETE_refused_after_readonly_override|PASS|refusal (exit 3)|
|ACL_TRUNCATE_refused_after_readonly_override|PASS|refusal (exit 3)|
|ACL_CREATE_TEMP_refused_after_readonly_override|PASS|refusal (exit 3)|
|excess_write_inventory_refused|PASS|refusal (exit 3)|
|excess_read_inventory_refused|PASS|refusal (exit 3)|
|PUBLIC_TEMP_inventory_refused|PASS|refusal (exit 3)|
|missing_table_inventory_refused|PASS|refusal (exit 3)|
|RLS_inventory_refused|PASS|refusal (exit 3)|
|unexpected_modern_table_refused|PASS|refusal (exit 3)|
|PUBLIC_security_definer_refused|PASS|refusal (exit 3)|
|role_membership_refused|PASS|refusal (exit 3)|
|inventory_restored_after_negative_tests|PASS|success (exit 0)|
|audit_session_held_before_revocation|PASS|success (exit 0)|
|revocation_script|PASS|success (exit 0)|
|NOLOGIN_does_not_terminate_existing_session|PASS|success (exit 0)|
|audit_session_closed_normally|PASS|success (exit 0)|
|revoked_login_refused|PASS|refusal (exit 2)|
|revoked_grants_and_zero_sessions|PASS|success (exit 0)|
|synthetic_orders_unchanged|PASS|success (exit 0)|

PASS for a refusal means the unsafe operation was rejected; it does not mean the permission was granted. Default READ ONLY denied writes. After explicitly overriding that session default, ACLs still denied INSERT, UPDATE, DELETE, TRUNCATE and CREATE TEMP. Excess grants, wrong role/database, missing table, RLS, modern tables, executable custom SECURITY DEFINER and membership were rejected. Revocation disabled new login and removed column grants; a previously open session remained until normally closed, then zero sessions were verified. There was no forced session termination; container removal occurred only after session closure in the successful run.

## PUBLIC privileges: solution and production limitation

The default PostgreSQL PUBLIC TEMPORARY grant caused the intended setup rejection and rolled back role creation completely. Granting TEMP back locally also caused inventory rejection. In the isolated fixture ONLY, REVOKE TEMPORARY ON DATABASE magiccitydb_3334 FROM PUBLIC was used to model a hardened ACL profile and exercise the successful cycle. It is NOT included in the production setup and is NOT proposed for automatic production execution.

There is no per-role DENY overriding PUBLIC. If the real production DB grants TEMP to PUBLIC, a strictly no-TEMP/no-write role cannot satisfy these unchanged guards merely through role-specific REVOKE or NOINHERIT. Do not disable the guard or mark direct production setup ready. default_transaction_read_only is user-overridable and does not solve inherited TEMP permissions.

Solution without modifying global production ACLs: separately authorize an encrypted/restricted snapshot and restore it into a dedicated isolated audit CLUSTER, with outbound integrations disabled. Harden ACLs ONLY on that isolated copy, create the audit role there and run the inventory. A copy can use the required database name only with separately verified isolated host identity; never confuse it with Render. No real snapshot/restore is authorized or executed here. Snapshot results are point-in-time evidence and cannot prove current LIVE payment/provider activity or new orders after snapshot. Copy custody/PII/retention and restore verification need separate approval.

If current live production inventory is indispensable, a DBA must approve a different constrained access architecture or a carefully assessed ACL change; this simulation does not provide a per-role workaround. Existing owner credentials must not be relabeled read-only. PUBLIC functions, provider roles, other database access and extensions still need review.

## Files changed/added in this task

Corrected: CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql; LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql.
Updated: PRODUCTION_18_AUDIT_ROLE_REVIEW.md with actual validation status.
Added: this report; pg18-simulation/run-postgres18.cjs and synthetic evidence files RESULTS.json, SERVER_VERSION.txt, inventory-synthetic.txt, first-pass evidence and previous PASS27_RESULTS.json. No passwords/verifiers persisted in result files. Local evidence is not a production backup and is not automatically intended for Git staging.

Command actually run (local-only): node tools/staging/audits/2026-10-10-production-readiness/pg18-simulation/run-postgres18.cjs. Runner contains exact Docker/psql/fixture commands and does not load any application .env. git diff --check PASS for existing tracked workspace diff; corrected new SQL was exercised against PostgreSQL. No application tests/builds required or run for this SQL-only task.

PRODUCTION_SQL_EXECUTED=NO
PRODUCTION_DATA_CHANGED=NO
APPLICATION_FILES_CHANGED_BY_THIS_TASK=NO
LOCAL_POSTGRESQL_VERSION=18.6
LOCAL_SQL_TESTS=30/30_PASS
TEMPORARY_CONTAINER_REMOVED=YES
PRODUCTION_PUBLIC_PRIVILEGES_VERIFIED=NO
READY_TO_EXECUTE_PRODUCTION_ROLE_SETUP=NO_PENDING_HUMAN_ACL_REVIEW
STARTUP_BLOCKER_REMOVED=NO

Submit corrected scripts and PUBLIC privilege decision for human review before ANY production administration or audit execution.
