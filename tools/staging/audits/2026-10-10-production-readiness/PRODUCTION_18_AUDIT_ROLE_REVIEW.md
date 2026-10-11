# Production PostgreSQL 18 - least-privilege audit preparation

PREPARATION ONLY. No connection, SQL execution, role creation, migration, order modification, commit/push/deployment. Original LEGACY_ORDERS_READ_ONLY.sql preserved. Startup blocker unchanged.

## Static findings on the original script

- Confirmed historical Order columns fit the original basic inventory. OrderItem exists. There is no StockReservation table in this architecture; new code uses OrderReservation/StockReservationItem, both absent in the confirmed production inventory.
- Absent PaymentAttempt/GuestOrderAccess/reservation/handoff tables are mostly safely skipped by conditional gexec. Their absence is not a zero-record result and cannot prove no Stripe activity.
- Original SELECT to_jsonb(o)/to_jsonb(t) reads whole rows, incompatible with column-only minimal grants and unnecessarily touches customer fields even though output omits them. New inventory selects only granted columns.
- Original script does not require dedicated session_user/current_user, check effective ACLs/role memberships, assert read-only rather than just display it, or detect RLS hiding rows. Owning account can write; transaction mode is not a substitute for restricted credentials.
- Original absent-Order branch prints BLOCKED but does not raise an error. The revised script fails if required objects/columns are absent; no silent empty fallback.
- Original order numbering sorts as text; revised inventory uses integer sorting. Counts compare the entire DB to #1-#12, with out-of-range and duplicate/missing matches.
- Original dynamic optional-table branches assume modern columns if those tables appear. New version is deliberately pinned to confirmed historical schema and STOPS on any unexpected additive table; review new schema and grants separately.
- Original prefixes are hints only, not confirmed LIVE status. Original SHA/migration data can be read with four explicit migration columns, never logs.

## Files submitted for human approval

1. CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql: ADMIN WRITES, creates new magiccity_prod_audit only if absent, verifies database/version/CREATEROLE authority, sets NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, one connection and 24-hour password validity, read-only/timeouts. Grants CONNECT, public USAGE and SELECT on only necessary columns of Order, OrderItem, _prisma_migrations. No User/Product/Discount access, sequence rights, future default grants or membership granted to audit role. Initially NOLOGIN with password NULL: only enable LOGIN after authentication-policy verification and interactive secure password assignment.
2. LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql: READ ONLY, fixed SELECTs, no gexec, no whole-row JSON. Requires exact production DB, PostgreSQL 18, dedicated authenticated role without SET ROLE, read-only defaults/transaction, minimal effective ACLs, no privileged memberships, no custom executable SECURITY DEFINER functions and no RLS on the three needed tables. Outputs only numbered orders, frozen totals/status/currency, counts and reference classifications/booleans, no customer fields or raw payment IDs.
3. REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql: ADMIN WRITES, disables login, clears password, removes exactly the column/schema/database grants. Does not delete any role/data/object or kill sessions. Existing sessions must be closed normally and verified zero; existing snapshots/statements may finish before shutdown.

Role creation requires CREATEROLE or appropriate administrator, not merely database ownership. Provider permission limits may block setup. All administrative SQL requires separate human validation. COMMIT is present only in administration scripts; inventory ends ROLLBACK.

## Risks and deliberate stop conditions

PostgreSQL permissions are additive; NOINHERIT does not remove PUBLIC privileges. PUBLIC commonly has database TEMPORARY and custom function EXECUTE. New setup checks effective privileges before COMMIT; if TEMP/CREATE/write/excess read/custom SECURITY DEFINER rights are inherited, setup ERRORS and rolls back. Do not treat this expected potential stop as a reason to weaken checks. Do not automatically REVOKE from PUBLIC: that could affect existing services. DBA must separately evaluate existing ACL/function ownership/external side effects, provider roles and a scoped approved solution before retry. There is no per-role DENY overriding PUBLIC.

The audit role can reset its default read-only setting; table/column ACLs plus forbidden membership/ownership are the actual persistent-data protection. Read-only transaction is additional defense. TEMP tables and dangerous custom functions are explicitly blocked rather than assumed safe. Extension/external functions, foreign servers and privileges outside this DB still need administrator review; this role design is not a universal sandbox. A LOGIN role is cluster-wide: PUBLIC CONNECT to other DBs may exist; no other DB connection is authorized here. Review that exposure separately without changing global ACLs automatically.

Minimal grants allow reading raw session columns privately to classify them, but the approved inventory NEVER outputs their full values. Restrict custody/use of credentials; no arbitrary queries or unapproved exports. Sensitive metadata in system catalogs may remain visible to normal logins. Protect terminal capture/APM, SQL logs and audit results.

## Windows PowerShell / Docker postgres:18 - commands for later approved execution

Docker Desktop must be running; approved official postgres:18 image must be available (these commands have NOT been run). The image is a client only; no local PostgreSQL server/container volume/database is started. Network connection goes only to independently verified production host with TLS.

Privately provision process environment, without pasting URLs/passwords into chat/history: PG_PRODUCTION_URL (admin, only for approved role administration), PG_PRODUCTION_AUDIT_URL (dedicated new login, only after password assignment), PRODUCTION_DATABASE_HOST (independently matched Render production hostname), PRODUCTION_SERVER_IDENTITY_VERIFIED=YES (audit operator attestation, NOT application config). Do not use staging URL or application .env. URI user/password are parsed locally and never put in command arguments. Environment secrets are still visible to authorized local Docker/OS administrators; do not share Docker inspect output. Use a trusted computer.

Paste the following function into PowerShell AFTER reviewing scripts. Merely defining it does not connect:

```powershell
function Invoke-MagicCityProductionAuditClient {
 param([Parameter(Mandatory)][ValidateSet('setup','password','inventory','revoke')][string]$Action)
 if ($env:PRODUCTION_SERVER_IDENTITY_VERIFIED -ne 'YES') { throw 'Independent production identity verification required' }
 $raw = if ($Action -eq 'inventory') { $env:PG_PRODUCTION_AUDIT_URL } else { $env:PG_PRODUCTION_URL }
 try { $u = [Uri]$raw } catch { throw 'Invalid dedicated connection configuration' }
 if (-not $raw -or $u.Scheme -notin @('postgres','postgresql') -or [Uri]::UnescapeDataString($u.AbsolutePath) -cne '/magiccitydb_3334' -or $u.Host -cne $env:PRODUCTION_DATABASE_HOST -or $u.Host -match 'staging' -or $u.Fragment) { throw 'Production target refused' }
 $query = @{}
 foreach ($part in $u.Query.TrimStart('?').Split('&')) {
   if (-not $part) { continue }
   $kv = $part.Split('=',2)
   if ($query.ContainsKey($kv[0])) { throw 'Duplicate connection parameter refused' }
   $query[$kv[0]] = if ($kv.Length -eq 2) { [Uri]::UnescapeDataString($kv[1]) } else { '' }
 }
 if ($query['sslmode'] -notin @('require','verify-full')) { throw 'TLS required' }
 $creds=$u.UserInfo.Split(':',2)
 if ($creds.Length -ne 2) { throw 'Dedicated credentials required' }
 $username=[Uri]::UnescapeDataString($creds[0])
 if (($Action -eq 'inventory' -and $username -cne 'magiccity_prod_audit') -or ($Action -ne 'inventory' -and $username -ceq 'magiccity_prod_audit')) { throw 'Wrong credential scope' }
 $folder=(Resolve-Path 'tools/staging/audits/2026-10-10-production-readiness').Path
 $files=@{setup='CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql';inventory='LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql';revoke='REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql'}
 $saved=@{}; $keys=@('PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSSLMODE','PGCONNECT_TIMEOUT','PGOPTIONS')
 foreach($key in $keys){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
 try {
   $env:PGHOST=$u.Host; $env:PGPORT=if($u.Port -gt 0){[string]$u.Port}else{'5432'}
   $env:PGDATABASE='magiccitydb_3334'; $env:PGUSER=$username
   $env:PGPASSWORD=[Uri]::UnescapeDataString($creds[1]); $env:PGSSLMODE=$query['sslmode']; $env:PGCONNECT_TIMEOUT='15'
   $env:PGOPTIONS=if($Action -eq 'inventory'){'-c default_transaction_read_only=on -c statement_timeout=30000'}else{'-c statement_timeout=30000'}
   $dockerArgs=@('run','--rm')
   $dockerArgs+=if($Action -eq 'password'){@('-it')}else{@('-i')}
   foreach($key in $keys){$dockerArgs+=@('--env',$key)}
   if($Action -ne 'password'){$dockerArgs+=@('--mount',"type=bind,source=$folder,target=/audit,readonly")}
   $dockerArgs+=@('postgres:18','psql','-X','-w','-v','ON_ERROR_STOP=1')
   if($Action -ne 'password'){$dockerArgs+=@('-f',('/audit/'+$files[$Action]))}
   & docker @dockerArgs
   if($LASTEXITCODE -ne 0){throw 'STOP: client/admin/audit failed; inspect errors privately, no automatic retry'}
 } finally {
   foreach($key in $keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')}
   $raw=$null; $creds=$null
 }
}
```

Separately approved sequence (each invocation is a connection; reverify host/identity before each):

```powershell
# ADMIN WRITES: only after explicit approval of setup and effective privilege risks.
Invoke-MagicCityProductionAuditClient -Action setup
# ONLY if setup succeeded; interactive admin connection for password assignment.
Invoke-MagicCityProductionAuditClient -Action password
# Inside psql, first verify: SELECT current_database(), current_user;
# Must show magiccitydb_3334 and reviewed admin. Then type:
# \password magiccity_prod_audit
# Enter unique temporary password in hidden prompts. After independently verifying
# SCRAM/TLS auth policy and successful password assignment, explicitly approved admin action:
# ALTER ROLE magiccity_prod_audit LOGIN;
# Then \q.
# Password assignment and LOGIN activation are ADMIN WRITES; never enable a passwordless login or trust auth.
# Configure PG_PRODUCTION_AUDIT_URL privately; then READ-ONLY inventory:
Invoke-MagicCityProductionAuditClient -Action inventory
# Close audit client normally; separately approved ADMIN revocation:
Invoke-MagicCityProductionAuditClient -Action revoke
```

Do NOT run inventory if setup failed or PUBLIC permission blockers remain. verify-full may require a separately provisioned CA mount/PGSSLROOTCERT; do not downgrade policy to bypass certificate failure. Do not echo URLs or use docker -e NAME=secret. No Docker commands or SQL executed by this preparation.

## Revocation verification / interpretation

After closing inventory session, revoke login/password and direct grants using the submitted script. Remaining audit sessions must be zero; investigate separately without automatic termination. A new login must be refused. Password expiry alone does not terminate sessions or revoke ACLs. Retain disabled role for traceability; optional DROP ROLE would require a separate review and is not provided. Never DROP OWNED or REASSIGN OWNED.

Counts/status/results remain UNKNOWN until approved execution. #1-#12 each matching once plus total=12 establishes only set completeness, not test classification. Missing modern tables establish schema absence, not absence of provider payments. LIVE status/test classification still requires read-only provider/business verification. Startup blocker stays unchanged.

References: PostgreSQL 18 CREATE ROLE https://www.postgresql.org/docs/18/sql-createrole.html ; privileges https://www.postgresql.org/docs/18/ddl-priv.html ; membership https://www.postgresql.org/docs/18/role-membership.html .

## Local execution validation update

PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2): 30/30 synthetic-only tests PASS. Corrected table/column/sequence privilege checks to use CASE (actual TOAST-object evaluation error discovered; intermediate parenthesis error corrected). No checks weakened. See POSTGRES18_LOCAL_SQL_VALIDATION.md and pg18-simulation/RESULTS.json. Revocation script unchanged. Default PUBLIC TEMP remains an expected refusal; the positive case hardened ONLY the disposable local DB. Production ACLs remain unknown and require human review. No direct production setup authorization or readiness is implied.
