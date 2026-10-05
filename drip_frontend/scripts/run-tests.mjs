// Reuse the esbuild version already locked by Vite; no browser or live API needed.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const entry of ["tests/product-loading.test.tsx", "tests/checkout-validation.test.tsx", "tests/store-backend-integration.test.tsx", "tests/store-handoff.test.tsx"]) {
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
