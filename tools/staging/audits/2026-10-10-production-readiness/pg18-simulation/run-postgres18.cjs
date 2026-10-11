const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,source=path.dirname(dir),docker='C:/Users/hp/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const endpoint='npipe:////./pipe/dockerDesktopLinuxEngine',name='magiccity-pg18-audit-sim-'+Date.now();
const env={};for(const k of ['PATH','Path','SystemRoot','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];
const adminPassword=crypto.randomBytes(32).toString('base64url'),auditPassword=crypto.randomBytes(32).toString('base64url');let created=false;const results=[];
function run(args,input,extra={}){return cp.spawnSync(docker,['--host',endpoint,...args],{env:{...env,...extra},input,encoding:'utf8',maxBuffer:8e6,timeout:60000});}
function sql(text,{audit=false,db='magiccitydb_3334'}={}){return run(['exec','-i','--env','PGPASSWORD',name,'psql','-X','-w','-h','127.0.0.1','-U',audit?'magiccity_prod_audit':'postgres','-d',db,'-v','ON_ERROR_STOP=1','-At','-f','-'],text,{PGPASSWORD:audit?auditPassword:adminPassword});}
function assertResult(label,r,success,pattern){const ok=(success?r.status===0:r.status!==0)&&(!pattern||pattern.test((r.stdout||'')+(r.stderr||'')));results.push({test:label,pass:ok,exitCode:r.status,expected:success?'success':'refusal'});console.log(label+' '+(ok?'PASS':'FAIL'));if(!ok){fs.writeFileSync(path.join(dir,'failure-redacted.txt'),((r.stdout||'')+(r.stderr||'')).replaceAll(adminPassword,'REDACTED').replaceAll(auditPassword,'REDACTED'));throw Error('Simulation assertion failed: '+label);}}
function admin(text){const r=sql(text);if(r.status!==0)throw Error('Synthetic fixture/admin operation failed');return r;}
const scripts={};for(const key of ['CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql','LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql','REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql'])scripts[key]=fs.readFileSync(path.join(source,key),'utf8');
const setup=()=>sql(scripts['CREATE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql']),inventory=(opts={})=>sql(scripts['LEGACY_ORDERS_PRODUCTION_18_MINIMAL.sql'],{audit:true,...opts});
(async()=>{try{
 const r=run(['run','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql:rw','--env','POSTGRES_PASSWORD','--env','POSTGRES_DB=magiccitydb_3334','--env','POSTGRES_HOST_AUTH_METHOD=scram-sha-256','postgres:18'],undefined,{POSTGRES_PASSWORD:adminPassword});if(r.status!==0)throw Error('Local isolated container start failed');created=true;
 let ready=false;for(let i=0;i<40;i++){const check=sql('SELECT 1;');if(check.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('Local database startup timeout');
 const version=admin("SELECT current_setting('server_version');").stdout.trim();fs.writeFileSync(path.join(dir,'SERVER_VERSION.txt'),version+'\n');
 admin(`CREATE TABLE public."Order"(id text PRIMARY KEY,"orderNumber" integer NOT NULL,status text NOT NULL,"paymentStatus" text NOT NULL,total numeric(10,2),currency text,"stripeSessionId" text,"sumupCheckoutId" text,"sumupPaymentId" text,"customerName" text,"customerEmail" text);
CREATE TABLE public."OrderItem"("orderId" text REFERENCES public."Order"(id),quantity integer,"productTitle" text);
CREATE TABLE public._prisma_migrations(migration_name text,checksum text,finished_at timestamptz,rolled_back_at timestamptz,logs text);
CREATE TABLE public."User"(id text,"passwordHash" text);
CREATE TABLE public."Collection"(id integer);CREATE TABLE public."Discount"(id integer);CREATE TABLE public."Product"(id integer);CREATE TABLE public."ProductCollection"(id integer);CREATE TABLE public."ProductImage"(id integer);CREATE TABLE public."Variant"(id integer);
INSERT INTO public."Order" SELECT 'synthetic-order-'||n,n,'PENDING',CASE WHEN n<=6 THEN 'PAID' ELSE 'PENDING' END,14.90,'EUR',CASE WHEN n=12 THEN 'cs_live_synthetic_not_a_payment' ELSE 'cs_test_synthetic_'||n END,NULL,NULL,'SYNTHETIC_PII_SENTINEL','nobody@example.invalid' FROM generate_series(1,12)n;
INSERT INTO public."OrderItem" SELECT id,1,'Synthetic item' FROM public."Order" CROSS JOIN generate_series(1,2);
INSERT INTO public._prisma_migrations SELECT 'synthetic_history_'||n,repeat('a',64),now(),NULL,'SYNTHETIC_LOG_SENTINEL' FROM generate_series(1,9)n;
INSERT INTO public."User" VALUES('synthetic-user','SYNTHETIC_PASSWORD_SENTINEL');`);
 assertResult('default_PUBLIC_TEMP_setup_refused',setup(),false,/division by zero/);
 assertResult('failed_setup_role_rolled_back',sql("SELECT count(*) FROM pg_roles WHERE rolname='magiccity_prod_audit';"),true,/^0\s*$/);
 admin('REVOKE TEMPORARY ON DATABASE magiccitydb_3334 FROM PUBLIC;');
 assertResult('hardened_LOCAL_ACL_setup',setup(),true);
 const salt=crypto.randomBytes(16),salted=crypto.pbkdf2Sync(auditPassword,salt,4096,32,'sha256'),client=crypto.createHmac('sha256',salted).update('Client Key').digest(),stored=crypto.createHash('sha256').update(client).digest('base64'),server=crypto.createHmac('sha256',salted).update('Server Key').digest('base64');
 const verifier='SCRAM-SHA-256$4096:'+salt.toString('base64')+'$'+stored+':'+server;
 assertResult('SCRAM_password_assignment_LOGIN_activation',sql("ALTER ROLE magiccity_prod_audit PASSWORD '"+verifier+"' LOGIN;"),true);
 const inv=inventory();assertResult('audit_inventory_complete',inv,true,/ROLLBACK/);fs.writeFileSync(path.join(dir,'inventory-synthetic.txt'),inv.stdout);
 assertResult('inventory_no_PII_or_raw_payment_reference',{status:0,stdout:String(!/SYNTHETIC_PII_SENTINEL|SYNTHETIC_PASSWORD_SENTINEL|SYNTHETIC_LOG_SENTINEL|cs_test_synthetic_|cs_live_synthetic_/.test(inv.stdout))},true,/true/);
 assertResult('wrong_role_inventory_refused',inventory({audit:false}),false,/division by zero/);
 assertResult('wrong_database_inventory_refused',inventory({db:'postgres'}),false,/division by zero/);
 assertResult('default_read_only_insert_refused',sql('INSERT INTO public."Order"(id,"orderNumber",status,"paymentStatus") VALUES(\'not-created\',99,\'PENDING\',\'PENDING\');',{audit:true}),false,/read-only/);
 for(const [label,stmt]of [['INSERT','INSERT INTO public."Order"(id,"orderNumber",status,"paymentStatus") VALUES(\'not-created\',99,\'PENDING\',\'PENDING\');'],['UPDATE','UPDATE public."Order" SET total=0;'],['DELETE','DELETE FROM public."Order";'],['TRUNCATE','TRUNCATE public."Order";'],['CREATE_TEMP','CREATE TEMP TABLE not_created(id int);']])assertResult('ACL_'+label+'_refused_after_readonly_override',sql('SET default_transaction_read_only=off;'+stmt,{audit:true}),false,/permission denied/);
 admin('GRANT INSERT ON public."Order" TO magiccity_prod_audit;');assertResult('excess_write_inventory_refused',inventory(),false,/division by zero/);admin('REVOKE INSERT ON public."Order" FROM magiccity_prod_audit;');
 admin('GRANT SELECT ON public."User" TO magiccity_prod_audit;');assertResult('excess_read_inventory_refused',inventory(),false,/division by zero/);admin('REVOKE SELECT ON public."User" FROM magiccity_prod_audit;');
 admin('GRANT TEMPORARY ON DATABASE magiccitydb_3334 TO PUBLIC;');assertResult('PUBLIC_TEMP_inventory_refused',inventory(),false,/division by zero/);admin('REVOKE TEMPORARY ON DATABASE magiccitydb_3334 FROM PUBLIC;');
 admin('ALTER TABLE public."OrderItem" RENAME TO "MissingOrderItem";');assertResult('missing_table_inventory_refused',inventory(),false,/division by zero/);admin('ALTER TABLE public."MissingOrderItem" RENAME TO "OrderItem";');
 admin('ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;');assertResult('RLS_inventory_refused',inventory(),false,/division by zero/);admin('ALTER TABLE public."Order" DISABLE ROW LEVEL SECURITY;');
 admin('CREATE TABLE public."PaymentAttempt"(id text);');assertResult('unexpected_modern_table_refused',inventory(),false,/division by zero/);admin('DROP TABLE public."PaymentAttempt";');
 admin("CREATE FUNCTION public.synthetic_definer() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1';");assertResult('PUBLIC_security_definer_refused',inventory(),false,/division by zero/);admin('DROP FUNCTION public.synthetic_definer();');
 admin('CREATE ROLE synthetic_extra; GRANT synthetic_extra TO magiccity_prod_audit;');assertResult('role_membership_refused',inventory(),false,/division by zero/);admin('REVOKE synthetic_extra FROM magiccity_prod_audit; DROP ROLE synthetic_extra;');
 assertResult('inventory_restored_after_negative_tests',inventory(),true,/ROLLBACK/);
 const held=cp.spawn(docker,['--host',endpoint,'exec','-i','--env','PGPASSWORD',name,'psql','-X','-w','-h','127.0.0.1','-U','magiccity_prod_audit','-d','magiccitydb_3334','-At','-v','ON_ERROR_STOP=1'],{env:{...env,PGPASSWORD:auditPassword},stdio:['pipe','pipe','pipe']});
 const heldExit=new Promise(resolve=>held.once('exit',code=>resolve(code)));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Synthetic held-session startup timeout')),5000);held.stdout.on('data',chunk=>{if(chunk.toString().includes('SIM_SESSION_READY')){clearTimeout(timer);resolve();}});held.once('error',()=>{clearTimeout(timer);reject(Error('Synthetic held-session client failure'));});held.stdin.write("BEGIN READ ONLY; SELECT 'SIM_SESSION_READY';\n");});
 assertResult('audit_session_held_before_revocation',sql("SELECT count(*) FROM pg_stat_activity WHERE usename='magiccity_prod_audit';"),true,/^1\s*$/);
 assertResult('revocation_script',sql(scripts['REVOKE_PRODUCTION_AUDIT_ROLE_REVIEW_ONLY.sql']),true);
 assertResult('NOLOGIN_does_not_terminate_existing_session',sql("SELECT count(*) FROM pg_stat_activity WHERE usename='magiccity_prod_audit';"),true,/^1\s*$/);
 held.stdin.end("ROLLBACK;\n\\q\n");const heldCode=await heldExit;assertResult('audit_session_closed_normally',{status:heldCode,stdout:''},true);
 assertResult('revoked_login_refused',sql('SELECT 1;',{audit:true}),false,/not permitted to log in|password authentication failed/);
 assertResult('revoked_grants_and_zero_sessions',sql("SELECT (NOT rolcanlogin)::int,(SELECT count(*) FROM pg_stat_activity WHERE usename='magiccity_prod_audit'),has_column_privilege('magiccity_prod_audit','public.\"Order\"','total','SELECT')::int FROM pg_roles WHERE rolname='magiccity_prod_audit';"),true,/1\|0\|0/);
 assertResult('synthetic_orders_unchanged',sql('SELECT count(*),sum(total) FROM public."Order";'),true,/12\|178.80/);
 fs.writeFileSync(path.join(dir,'RESULTS.json'),JSON.stringify({version,network:'none',publishedPorts:[],productionCredentialsUsed:false,productionConnections:false,results},null,2));
 }catch(e){console.error(e.message);fs.writeFileSync(path.join(dir,'RESULTS.json'),JSON.stringify({error:e.message,results},null,2));process.exitCode=1;}finally{if(created){const stop=run(['rm','-f',name]);console.log('owned_temporary_container_removed='+(stop.status===0));}}})();
