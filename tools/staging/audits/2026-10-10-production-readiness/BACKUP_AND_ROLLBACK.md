# Magic City Drip - production readiness audit, 2026-10-10

All external configuration: REQUIRES MANUAL CHECK unless labelled BLOCKED. No remote action performed.

## Readiness

VERIFIED: pg_dump/pg_restore 17.11 installed at C:/Program Files/PostgreSQL/17/bin. Docker unavailable on PATH. Disk C has approximately 359640047616 bytes free at audit. Production server version and DB size UNKNOWN: compatibility/capacity cannot be marked PASS. PostgreSQL 17 pg_dump cannot dump PostgreSQL 18. Use an approved client major >= source server (prefer matching major), and matching pg_restore.

REQUIRES MANUAL CHECK: choose destination outside repository, e.g. C:/Users/hp/Desktop/work/magiccity-production-backups, verify restrictive NTFS ACL and encrypted volume/container before writing. Neither encryption nor ACL is certified here. Dump can contain full personal data and credentials in application tables. Limit retention/access; never commit dump or place in docs/logs. Custom format compression is NOT encryption.

## Guarded procedure for later explicit authorization - NOT RUN

Set PG_PRODUCTION_URL securely in the executing process, PRODUCTION_DATABASE_HOST only after independent Render production DB verification; set PG_BIN to approved tool directory and BACKUP_DIRECTORY to pre-created encrypted/restricted directory. No credentials in chat, filenames or CLI URI arguments. Execute the following Node code through a PowerShell single-quoted here-string piped to node. It intentionally suppresses external error details; on error stop and inspect redacted logs privately, no automatic retry.

~~~javascript
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
try {
 const raw=process.env.PG_PRODUCTION_URL,host=process.env.PRODUCTION_DATABASE_HOST;
 if(!raw||!host||process.env.BACKUP_SECURITY_VERIFIED!=='YES')throw Error();
 const u=new URL(raw);
 if(!['postgres:','postgresql:'].includes(u.protocol)||decodeURIComponent(u.pathname)!=='/magiccitydb_3334'||u.hostname!==host||u.hash||/staging/i.test(u.hostname)||!['require','verify-full'].includes(u.searchParams.get('sslmode')))throw Error();
 const bin=process.env.PG_BIN,dir=process.env.BACKUP_DIRECTORY;
 if(!bin||!dir||!path.isAbsolute(dir)||!fs.statSync(dir).isDirectory())throw Error();
 const env={};for(const k of ['PATH','Path','SystemRoot','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
 Object.assign(env,{PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:'magiccitydb_3334',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:u.searchParams.get('sslmode'),PGCONNECT_TIMEOUT:'15',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=60000'});
 // Re-run URI/hostname checks before each remote command; host identity has been independently verified.
 const guard=()=>{const v=new URL(process.env.PG_PRODUCTION_URL);if(decodeURIComponent(v.pathname)!=='/magiccitydb_3334'||v.hostname!==process.env.PRODUCTION_DATABASE_HOST)throw Error();};
 const run=(tool,args,remote=false)=>{if(remote)guard();const r=cp.spawnSync(path.join(bin,tool+'.exe'),args,{env,encoding:'utf8',maxBuffer:8e6});if(r.status!==0)throw Error();return r.stdout;};
 const identity=run('psql',['-X','-w','-At','-v','ON_ERROR_STOP=1','-c',"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT current_database() || '|' || current_setting('server_version_num'); ROLLBACK;"],true).split(/\r?\n/).find(x=>x.startsWith('magiccitydb_3334|'));
 if(!identity)throw Error();const serverMajor=Math.floor(Number(identity.split('|')[1])/10000);
 const dumpMajor=Number(run('pg_dump',['--version']).match(/PostgreSQL\) (\d+)/)[1]);
 if(dumpMajor<serverMajor)throw Error();
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),file=path.join(dir,'magiccitydb_3334-prepromotion-'+stamp+'.dump');
 if(fs.existsSync(file))throw Error();
 // Long dump duration is allowed; lock acquisition timeout remains bounded.
 env.PGOPTIONS='-c default_transaction_read_only=on';
 run('pg_dump',['-w','--format=custom','--lock-wait-timeout=30s','--file',file],true);
 run('pg_restore',['--list',file]);
 const sha=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 console.log(JSON.stringify({path:file,size:fs.statSync(file).size,sha256:sha,listValidated:true}));
} catch {console.error('BACKUP_STOPPED: target, tool, security or operation check failed; do not retry automatically.');process.exitCode=1;}
~~~

For very large databases replace in-memory SHA calculation with streaming and validate free space against estimated dump plus rehearsal requirements before execution. This backup is database-local, not cluster roles/tablespaces/provider configuration: document these prerequisites separately. Confirm pg_dump stderr warnings privately even on exit0. pg_restore --list checks archive readability, NOT restore correctness.

## Restore rehearsal - separate explicit authorization required

Provision a separate isolated empty database (never magiccitydb_3334 or magiccity_db_staging), with outbound email/Stripe/network disabled, matching extensions/roles/encoding and target PostgreSQL major >= dump major. Verify its identity and host independently, then pg_restore --exit-on-error --no-owner --no-privileges --dbname=<isolated name> <dump> via secret-free PG* environment. No --clean against any existing database. Compare schema/migration checksums, non-PII aggregate counts and representative constraints; verify backups can be decrypted and hash matches. Store no raw restored data in reports.

## Downtime and rollback

Logical pg_dump normally permits concurrent reads/writes but waits for locks and can load IO; exact duration UNKNOWN without size/throughput rehearsal. Backup captures a consistent snapshot, not subsequent transactions and not global roles. Stop intake and drain/inventory in-flight orders before migrations/rollout; indexes/DDL can block writes. Window estimate must come from rehearsal, not guessed minutes.

Prefer application rollback to a schema-compatible release that understands already-issued grants/tickets/payment attempts and frozen request URLs. Historical production handlers lack these protections and are not automatically safe rollback candidates after new traffic. Disable only NEW handoff intake via reviewed plan; preserve redemption, confirmation, webhooks and old return routes. Do not rewrite active requests or create replacement sessions. Never automatically restore old data over production. Data recovery requires separate incident authorization, reconciliation of post-snapshot payments, RPO/RTO and customer impact review.

Source: https://www.postgresql.org/docs/18/app-pgdump.html
