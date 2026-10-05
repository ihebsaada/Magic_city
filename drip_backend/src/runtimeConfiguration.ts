export function runtimeConfiguration(env:NodeJS.ProcessEnv=process.env){
 const port=Number(env.PORT||4000);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('INVALID_PORT');
 if(env.DEPLOYMENT_ENV!==undefined&&!['staging','production','development','test'].includes(env.DEPLOYMENT_ENV))throw new Error('INVALID_DEPLOYMENT_ENV');
 if(env.DEPLOYMENT_ENV!=='staging')return {port,staging:false as const};
 const required=(name:string)=>{const value=env[name];if(!value?.trim())throw new Error('STAGING_CONFIG_REQUIRED');return value;};
 let database:URL;try{database=new URL(required('DATABASE_URL'));}catch{throw new Error('STAGING_DATABASE_DENIED');}
 if(!['postgres:','postgresql:'].includes(database.protocol)||decodeURIComponent(database.pathname)!=='/magiccity_db_staging'||database.hostname!==required('STAGING_DATABASE_HOST')||database.hash)throw new Error('STAGING_DATABASE_DENIED');
 if(!/^sk_test_[A-Za-z0-9_]+$/.test(required('STRIPE_SECRET_KEY')))throw new Error('STAGING_STRIPE_DENIED');
 if(!/^whsec_[A-Za-z0-9_]+$/.test(required('STRIPE_WEBHOOK_SECRET')))throw new Error('STAGING_WEBHOOK_DENIED');
 if(required('JWT_SECRET').length<32)throw new Error('STAGING_JWT_DENIED');
 const origin=(name:string)=>{let u:URL;try{u=new URL(required(name));}catch{throw new Error('STAGING_ORIGIN_DENIED');}
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||['magiccitydrip.shop','dripcheckout.netlify.app','magic-city-n6rr.onrender.com'].includes(u.hostname))throw new Error('STAGING_ORIGIN_DENIED');return u.origin;};
 const store=origin('STAGING_STORE_ORIGIN'),checkout=origin('STAGING_CHECKOUT_ORIGIN');
 const api=origin('STAGING_API_ORIGIN');
 const checkoutURL=new URL(required('CHECKOUT_APP_URL'));
 if(checkoutURL.origin!==checkout||checkoutURL.username||checkoutURL.password||checkoutURL.search||checkoutURL.hash)throw new Error('STAGING_REDIRECT_DENIED');
 const returnURL=(name:string)=>{let u:URL;try{u=new URL(required(name));}catch{throw new Error('STAGING_REDIRECT_DENIED');}
 if(u.origin!==checkout||u.username||u.password||u.hash||/token|secret/i.test(u.search))throw new Error('STAGING_REDIRECT_DENIED');};
 returnURL('STRIPE_SUCCESS_URL');returnURL('STRIPE_CANCEL_URL');
 if(env.STRIPE_API_VERSION)throw new Error('STAGING_STRIPE_VERSION_OVERRIDE_DENIED');
 return {port,staging:true as const,origins:[store,checkout,api],handoffOrigins:{store,checkout}};
}
