import {build} from "esbuild";import {spawnSync} from "node:child_process";import {fileURLToPath} from "node:url";import path from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const result=await build({absWorkingDir:root,entryPoints:["tests/secure-checkout.test.ts"],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",alias:{"@":path.join(root,"src")},define:{"import.meta.env":"{}"}});
const child=spawnSync(process.execPath,["--input-type=commonjs"],{cwd:root,input:result.outputFiles[0].text,stdio:["pipe","inherit","inherit"]});if(child.error)throw child.error;process.exitCode=child.status??1;

const staging={MODE:"staging",DEV:true,PROD:false,VITE_LOCAL_STRIPE_ORIGIN:"http://127.0.0.1:4101"};
const matrix=[
 ["local-staging",staging,true],
 ["missing-config",{...staging,VITE_LOCAL_STRIPE_ORIGIN:undefined},false],
 ["incorrect-config",{...staging,VITE_LOCAL_STRIPE_ORIGIN:"http://127.0.0.1:4102"},false],
 ["production",{...staging,MODE:"production",DEV:false,PROD:true},false],
 ["staging-production-build",{...staging,DEV:false,PROD:true},false],
 ["development-mode",{...staging,MODE:"development"},false],
 ["wrong-frontend-origin",staging,false,"http://127.0.0.1:5175"]
];
for(const [name,env,allowed,origin] of matrix){
 console.log("Payment URL configuration: "+name);
 const bundle=await build({absWorkingDir:root,entryPoints:["tests/payment-url.test.ts"],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",alias:{"@":path.join(root,"src")},define:{"import.meta.env":JSON.stringify(env)}});
 const run=spawnSync(process.execPath,["--input-type=commonjs"],{cwd:root,input:bundle.outputFiles[0].text,env:{...process.env,PAYMENT_SIMULATOR_ALLOWED:String(allowed),PAYMENT_BROWSER_ORIGIN:origin??"http://127.0.0.1:5174"},stdio:["pipe","inherit","inherit"]});
 if(run.error)throw run.error;if(run.status!==0)process.exitCode=run.status??1;
}

const navigation=await build({absWorkingDir:root,entryPoints:["tests/store-navigation.test.ts"],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",define:{"import.meta.env":"{}"}});
const navigationRun=spawnSync(process.execPath,["--input-type=commonjs"],{cwd:root,input:navigation.outputFiles[0].text,stdio:["pipe","inherit","inherit"]});
if(navigationRun.error)throw navigationRun.error;if(navigationRun.status!==0)process.exitCode=navigationRun.status??1;

const redirect=await build({absWorkingDir:root,entryPoints:["tests/store-redirect.test.ts"],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",define:{"import.meta.env":JSON.stringify({VITE_STORE_ORIGIN:"https://store.example.invalid"})}});
const redirectRun=spawnSync(process.execPath,["--input-type=commonjs"],{cwd:root,input:redirect.outputFiles[0].text,stdio:["pipe","inherit","inherit"]});if(redirectRun.error)throw redirectRun.error;if(redirectRun.status!==0)process.exitCode=redirectRun.status??1;
