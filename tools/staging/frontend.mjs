import path from 'node:path';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.env.STAGING_FRONTEND_ROOT;
if(!root||!['5173','5174'].includes(process.env.STAGING_FRONTEND_PORT))throw new Error('Invalid staging frontend');
const require=createRequire(path.join(root,'package.json'));
const {createServer,build}=await import(pathToFileURL(path.join(path.dirname(require.resolve('vite/package.json')),'dist/node/index.js')));
const nonce='synthetic-staging-only-nonce';
const prefixedBuild=process.env.STAGING_CHECKOUT_BASE==='/checkout/';
const options={root,mode:'staging',envDir:process.env.STAGING_ENV_DIR,html:{cspNonce:nonce},
 ...(prefixedBuild?{base:'/checkout/',define:{'import.meta.env.VITE_ROUTER_BASENAME':JSON.stringify('/checkout/')}}:{}),
 server:{host:'127.0.0.1',port:Number(process.env.STAGING_FRONTEND_PORT),strictPort:true,fs:{strict:true,allow:[root],deny:['**/.env','**/.env.*','**/*.{crt,pem}','**/.git/**','**/.runtime/**','**/scenario-private.json']},headers:{
 'Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'nonce-"+nonce+"'; style-src 'self' 'nonce-"+nonce+"'; img-src 'self' http://127.0.0.1:4100 data:; font-src 'self'; connect-src 'self' http://127.0.0.1:4100 ws://127.0.0.1:5173 ws://127.0.0.1:5174; object-src 'none'; base-uri 'self'"
 }}};
if(process.env.STAGING_BUILD_DIR){await build({...options,build:{outDir:process.env.STAGING_BUILD_DIR,emptyOutDir:false}});}
else {
if(process.env.STAGING_COMMON_CHECKOUT_ROOT){
 if(process.env.STAGING_FRONTEND_PORT!=='5173')throw new Error('Common Checkout requires Store port');
 const checkoutRoot=process.env.STAGING_COMMON_CHECKOUT_ROOT;
 const checkout=await createServer({...options,root:checkoutRoot,base:'/checkout/',
  cacheDir:path.join(process.env.STAGING_ENV_DIR,'vite-checkout-prefix'),
  define:{'import.meta.env.VITE_ROUTER_BASENAME':JSON.stringify('/checkout/'),'import.meta.env.VITE_LOCAL_STRIPE_ORIGIN':JSON.stringify('http://127.0.0.1:4101')},
  server:{...options.server,middlewareMode:true,hmr:false,fs:{...options.server.fs,allow:[checkoutRoot]}}});
 // Mounted before Store's SPA fallback; paths and Vite modules stay namespaced.
 options.plugins=[{name:'staging-checkout-mount',configureServer(storeServer){storeServer.middlewares.use((req,res,next)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:5173').pathname;
  const assetsRoot=pathname.startsWith('/checkout/assets/')?checkoutRoot:root;
  const assetPath=pathname.replace(/^\/checkout\//,'/');
  if(assetPath.startsWith('/assets/')&&!fs.existsSync(path.join(assetsRoot,'public',assetPath))){
   res.statusCode=404;res.end('Not Found');return;
  }
  if(pathname==='/checkout'){res.writeHead(308,{Location:'/checkout/'});res.end();return;}
  if(!pathname.startsWith('/checkout/'))return next();
  for(const [key,value] of Object.entries(options.server.headers))res.setHeader(key,value);
  checkout.middlewares(req,res,()=>{res.statusCode=404;res.end('Not Found');});
 });}}];
}
const server=await createServer(options);
await server.listen();
console.log('Staging frontend on http://127.0.0.1:'+process.env.STAGING_FRONTEND_PORT);

}
