// New loopback-only disposable cluster. Never inherits deployment credentials or runs migrations/seeds.
const fs = require("node:fs"),
  path = require("node:path"),
  net = require("node:net"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  pg = process.env.PG_TEST_BIN || "C:/Program Files/PostgreSQL/17/bin";
const env = {};
for (const k of ["PATH", "Path", "SystemRoot", "TEMP", "TMP"])
  if (process.env[k]) env[k] = process.env[k];
Object.assign(env, {
  NODE_ENV: "test",
  JWT_SECRET: "synthetic-only-signing-key",
  STRIPE_SECRET_KEY: "sk_test_synthetic_not_a_real_key",
  STRIPE_WEBHOOK_SECRET: "synthetic",
  CHECKOUT_APP_URL: "https://checkout.example.invalid",
  STRIPE_SUCCESS_URL:
    "https://checkout.example.invalid/success?orderId={ORDER_ID}",
  STRIPE_CANCEL_URL:
    "https://checkout.example.invalid/cancel?orderId={ORDER_ID}",
});
env.NAVIGATION_HANDOFF_SECRET = "synthetic-navigation-only-".repeat(3);
function run(exe, args, quiet = false) {
  const r = spawnSync(exe, args, {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: quiet ? "ignore" : "inherit",
    timeout: 180000,
  });
  if (r.status !== 0)
    throw Error(
      r.error?.message || "Isolated command failed: " + path.basename(exe),
    );
}
(async () => {
  const data = path.join(root, "tests", ".pg-admin-v2-" + Date.now());
  const port = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
  let started = false;
  try {
    run(
      path.join(pg, "initdb.exe"),
      [
        "-D",
        data,
        "-U",
        "lot4_test",
        "-A",
        "trust",
        "--encoding=UTF8",
        "--no-locale",
      ],
      true,
    );
    run(
      path.join(pg, "pg_ctl.exe"),
      [
        "-D",
        data,
        "-l",
        path.join(data, "server.log"),
        "-o",
        "-h 127.0.0.1 -p " + port,
        "-w",
        "start",
      ],
      true,
    );
    started = true;
    run(
      path.join(pg, "createdb.exe"),
      [
        "-h",
        "127.0.0.1",
        "-p",
        String(port),
        "-U",
        "lot4_test",
        "lot4_isolated",
      ],
      true,
    );
    env.DATABASE_URL =
      "postgresql://lot4_test@127.0.0.1:" + port + "/lot4_isolated";
    console.log(
      "Disposable synthetic database only; no migration or seed scripts.",
    );
    run(process.execPath, [
      require.resolve("prisma/build/index.js"),
      "db",
      "push",
      "--skip-generate",
    ]);
    run(process.execPath, [path.join(__dirname, "admin-v2-fixture.cjs")]);
    const suites = [
      "idempotency",
      "payment",
      "reservations",
      "guest-access",
      "handoff",
      "navigation",
      "catalog",
      "secure-order-policy",
      "admin-v2",
    ].filter(
      (name) => !process.argv.includes("--admin-only") || name === "admin-v2",
    );
    for (const name of suites) {
      if (name === "secure-order-policy")
        run(process.execPath, [
          "-e",
          `const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();db.order.upsert({where:{id:'policy-historical-before-migration'},update:{},create:{id:'policy-historical-before-migration',customerName:'Synthetic policy legacy',customerEmail:'policy-legacy@example.invalid',total:12.34,currency:'EUR',stripeSessionId:'cs_test_policy_historical'}}).finally(()=>db.$disconnect());`,
        ]);
      const result = spawnSync(
        process.execPath,
        [
          "--test",
          ...(name === "secure-order-policy"
            ? [
                "--test-skip-pattern",
                "database policy constraints and completed migration history",
              ]
            : []),
          "tests/" + name + ".integration.test.cjs",
        ],
        { cwd: root, env, encoding: "utf8", timeout: 180000 },
      );
      const output = (result.stdout || "") + (result.stderr || "");
      fs.writeFileSync(
        path.join(__dirname, "admin-v2-" + name + ".log"),
        output,
      );
      console.log(
        name +
          ": " +
          output
            .split("\n")
            .filter((line) => /tests |pass |fail |skip/.test(line))
            .slice(-5)
            .join(" | "),
      );
      if (result.status !== 0) {
        console.error(output.slice(-9000));
        throw Error("Isolated suite failed: " + name);
      }
    }
  } finally {
    if (started)
      run(
        path.join(pg, "pg_ctl.exe"),
        ["-D", data, "-w", "stop", "-m", "fast"],
        true,
      );
    console.log("Stopped isolated cluster retained at " + data);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
