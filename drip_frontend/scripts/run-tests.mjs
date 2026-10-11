// Reuse the esbuild version already locked by Vite; no browser or live API needed.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const entry of ["tests/payment-warning.test.tsx", "tests/product-grid.test.tsx", "tests/product-loading.test.tsx", "tests/checkout-validation.test.tsx", "tests/store-backend-integration.test.tsx", "tests/store-handoff.test.tsx", "tests/historical-loading.test.tsx", "tests/automatic-handoff.test.ts"]) {
const result = await build({
  absWorkingDir: root,
  entryPoints: [entry],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  jsx: "automatic",
  alias: { "@": path.join(root, "src") },
  define: { "import.meta.env": "{}" },
});
// Separate processes isolate renderer contexts and browser/storage mocks.
const child = spawnSync(process.execPath, ["--input-type=commonjs"], { cwd: root, input: result.outputFiles[0].text, stdio: ["pipe", "inherit", "inherit"] });
if (child.error) throw child.error;
if (child.status !== 0) process.exitCode = child.status ?? 1;
}

for(const mode of ['staging','production']){
const nav=await build({absWorkingDir:root,entryPoints:['tests/navigation-handoff.test.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':path.join(root,'src')},define:{'import.meta.env':JSON.stringify({MODE:mode,VITE_NAVIGATION_HANDOFF_ENABLED:'true',VITE_CHECKOUT_ORIGIN:'https://checkout.example.invalid'})}});
const run=spawnSync(process.execPath,['--input-type=commonjs'],{cwd:root,input:nav.outputFiles[0].text,stdio:['pipe','inherit','inherit']});if(run.status!==0)process.exitCode=run.status??1;

}

for(const [mode,flag,expected] of [['production','true',true],['production','false',false],['staging','true',true],['development','true',false],['test','true',false],['production',undefined,false]]){
 const bundle=await build({absWorkingDir:root,entryPoints:['tests/production-mode.test.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',alias:{'@':path.join(root,'src')},define:{'import.meta.env':JSON.stringify({MODE:mode,VITE_NAVIGATION_HANDOFF_ENABLED:flag})}});
 const child=spawnSync(process.execPath,['--input-type=commonjs'],{cwd:root,input:bundle.outputFiles[0].text,env:{...process.env,EXPECT_NAVIGATION:String(expected)},stdio:['pipe','inherit','inherit']});if(child.status!==0)process.exitCode=child.status??1;
}
