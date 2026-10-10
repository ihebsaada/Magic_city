import {validateStripeApiVersion} from './stripeApiVersion';
// Production parsing is pure: never constructs clients or connects to a database.
export function productionConfiguration(env:NodeJS.ProcessEnv){
 const fail=(code:string):never=>{throw new Error('PRODUCTION_'+code);};
 const required=(name:string)=>{const v=env[name];if(!v||v.trim()!==v)return fail('CONFIG_REQUIRED');return v;};
 if(env.NODE_ENV!=='production')fail('NODE_ENV_DENIED');
 if(Object.keys(env).some(k=>k.startsWith('STAGING_')&&env[k]))fail('STAGING_CONFIG_DENIED');
 let db:URL;try{db=new URL(required('DATABASE_URL'));}catch{return fail('DATABASE_DENIED');}
 if(!['postgres:','postgresql:'].includes(db.protocol)||decodeURIComponent(db.pathname)!=='/magiccitydb_3334'||db.hostname!==required('PRODUCTION_DATABASE_HOST')||/staging/i.test(db.hostname)||db.hash||!['require','verify-full'].includes(db.searchParams.get('sslmode')||''))fail('DATABASE_DENIED');
 if(!/^sk_live_[A-Za-z0-9_]+$/.test(required('STRIPE_SECRET_KEY')))fail('STRIPE_DENIED');
 if(!/^whsec_[A-Za-z0-9_]+$/.test(required('STRIPE_WEBHOOK_SECRET')))fail('WEBHOOK_DENIED');
 const jwt=required('JWT_SECRET'),ticket=required('NAVIGATION_HANDOFF_SECRET');
 if(jwt.length<32||ticket.length<32||new Set([jwt,ticket,env.STRIPE_SECRET_KEY,env.STRIPE_WEBHOOK_SECRET]).size!==4)fail('SECRET_DENIED');
 if(required('STRIPE_CURRENCY')!=='eur')fail('STRIPE_CONFIG_DENIED');
 validateStripeApiVersion(env.STRIPE_API_VERSION);
 const origin=(key:string)=>{let u:URL;try{u=new URL(required(key));}catch{return fail('ORIGIN_DENIED');}if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||/staging|localhost|example\.invalid/i.test(u.hostname))fail('ORIGIN_DENIED');return u.origin;};
 const store=origin('PRODUCTION_STORE_ORIGIN'),checkout=origin('PRODUCTION_CHECKOUT_ORIGIN'),api=origin('PRODUCTION_API_ORIGIN');
 if(new Set([store,checkout,api]).size!==3)fail('ORIGIN_DENIED');
 if(required('CHECKOUT_APP_URL')!==checkout)fail('REDIRECT_DENIED');
 const success=checkout+'/order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}';
 const cancel=checkout+'/checkout-landing?orderId={ORDER_ID}';
 if(required('STRIPE_SUCCESS_URL')!==success||required('STRIPE_CANCEL_URL')!==cancel)fail('REDIRECT_DENIED');
 if(!['true','false'].includes(required('NAVIGATION_HANDOFF_ENABLED')))fail('NAVIGATION_CONFIG_DENIED');
 return {production:true as const,staging:false as const,origins:[store,checkout,api],handoffOrigins:{store,checkout},navigationHandoffEnabled:env.NAVIGATION_HANDOFF_ENABLED==='true'};
}
// No environment bypass: legacy ownership/recovery rollout has not been established.
export function requireProductionLegacyReadiness():never{throw new Error('PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED');}
