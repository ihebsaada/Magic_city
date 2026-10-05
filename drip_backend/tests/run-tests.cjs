const { spawnSync } = require("node:child_process");
// Never inherit database, Stripe, JWT, NODE_OPTIONS or dotenv configuration from the shell.
const env = {};
for (const key of ["PATH", "Path", "SystemRoot", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
Object.assign(env, { NODE_ENV: "test", JWT_SECRET: "synthetic-only-signing-key",
  STRIPE_SECRET_KEY: "sk_test_synthetic_not_a_real_key", STRIPE_WEBHOOK_SECRET: "synthetic-webhook",
  DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:1/synthetic",
  CHECKOUT_APP_URL: "https://checkout.example.invalid", STRIPE_SUCCESS_URL: "https://checkout.example.invalid/success?orderId={ORDER_ID}",
  STRIPE_CANCEL_URL: "https://checkout.example.invalid/cancel?orderId={ORDER_ID}" });
const child = spawnSync(process.execPath, ["--test", "tests/contracts.test.cjs", "tests/runtime-staging.test.cjs"], { env, stdio: "inherit" });
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
