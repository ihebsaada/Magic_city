const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
let grant = {
  orderId: "authorized-order",
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60000),
};
require.cache[require.resolve("../dist/prisma.js")] = {
  exports: {
    __esModule: true,
    default: {
      secureOrderPolicy: { findUnique: async () => ({ policyVersion: 1 }) },
      guestOrderAccess: { findUnique: async () => grant },
      order: {
        findUnique: async () => ({
          id: "authorized-order",
          total: "14.90",
          currency: "EUR",
          status: "PENDING",
          paymentStatus: "PENDING",
          createdAt: new Date(),
        }),
      },
    },
  },
};
const { runtimeConfiguration } = require("../dist/runtimeConfiguration");
const {
  requireProductionLegacyReadiness,
} = require("../dist/productionConfiguration");
const good = {
  DEPLOYMENT_ENV: "production",
  NODE_ENV: "production",
  DATABASE_URL:
    "postgresql://synthetic:synthetic@db.prod.invalid/magiccitydb_3334?sslmode=require",
  PRODUCTION_DATABASE_HOST: "db.prod.invalid",
  STRIPE_SECRET_KEY: "sk_live_synthetic_only",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic_only",
  STRIPE_CURRENCY: "eur",
  JWT_SECRET: "jwt-synthetic-".repeat(4),
  NAVIGATION_HANDOFF_SECRET: "ticket-synthetic-".repeat(4),
  PRODUCTION_ADMIN_ORIGIN: "https://admin.prod.invalid",
  PRODUCTION_STORE_ORIGIN: "https://store.prod.invalid",
  PRODUCTION_CHECKOUT_ORIGIN: "https://checkout.prod.invalid",
  PRODUCTION_API_ORIGIN: "https://api.prod.invalid",
  CHECKOUT_APP_URL: "https://checkout.prod.invalid",
  STRIPE_SUCCESS_URL:
    "https://checkout.prod.invalid/order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}",
  STRIPE_CANCEL_URL:
    "https://checkout.prod.invalid/checkout-landing?orderId={ORDER_ID}",
  NAVIGATION_HANDOFF_ENABLED: "true",
};

test("Admin production origin accepts authorized preflights but never Store/Checkout handoffs", async () => {
  const { createApp } = require("../dist/app"),
    c = runtimeConfiguration(good),
    s = createApp({
      logging: false,
      production: true,
      allowedOrigins: c.origins,
      handoffOrigins: c.handoffOrigins,
      navigationHandoffEnabled: true,
    }).listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const base = "http://127.0.0.1:" + s.address().port;
  try {
    for (const [path, method] of [
      ["auth/login", "POST"],
      ["products", "GET"],
      ["products/1", "PATCH"],
      ["products/1/collections", "PUT"],
      ["products/1", "DELETE"],
    ]) {
      const r = await fetch(base + "/api/admin/" + path, {
        method: "OPTIONS",
        headers: {
          Origin: good.PRODUCTION_ADMIN_ORIGIN,
          "Access-Control-Request-Method": method,
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      });
      assert.equal(r.status, 204);
      assert.equal(
        r.headers.get("access-control-allow-origin"),
        good.PRODUCTION_ADMIN_ORIGIN,
      );
      assert.match(
        r.headers.get("access-control-allow-headers"),
        /Authorization/,
      );
    }
    const unauth = await fetch(base + "/api/admin/products", {
      headers: { Origin: good.PRODUCTION_ADMIN_ORIGIN },
    });
    assert.equal(unauth.status, 401);
    assert.equal(
      unauth.headers.get("access-control-allow-origin"),
      good.PRODUCTION_ADMIN_ORIGIN,
    );
    const bad = await fetch(base + "/api/admin/products", {
      method: "OPTIONS",
      headers: { Origin: "https://foreign.invalid" },
    });
    assert.equal(bad.status, 403);
    assert.equal((await bad.json()).error, "ORIGIN_DENIED");
    for (const route of [
      "/api/order-handoffs",
      "/api/navigation-handoffs/redeem",
      "/api/orders/x/handoffs/x/approve",
      "/api/orders/x/navigation-handoffs",
    ])
      assert.equal(
        (
          await fetch(base + route, {
            method: "OPTIONS",
            headers: { Origin: good.PRODUCTION_ADMIN_ORIGIN },
          })
        ).status,
        403,
      );
  } finally {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
});
test("Admin origin rejects paths, trailing slash, credentials, non-HTTPS and duplicates", () => {
  for (const value of [
    "http://admin.prod.invalid",
    "https://admin.prod.invalid/",
    "https://admin.prod.invalid/path",
    "https://user:pass@admin.prod.invalid",
    good.PRODUCTION_STORE_ORIGIN,
  ])
    assert.throws(() =>
      runtimeConfiguration({ ...good, PRODUCTION_ADMIN_ORIGIN: value }),
    );
});
test("production configuration independent of staging with explicit handoff flag", () => {
  const c = runtimeConfiguration(good);
  assert.equal(c.production, true);
  assert.equal(c.staging, false);
  assert.equal(c.navigationHandoffEnabled, true);
  assert.deepEqual(c.origins, [
    good.PRODUCTION_STORE_ORIGIN,
    good.PRODUCTION_CHECKOUT_ORIGIN,
    good.PRODUCTION_API_ORIGIN,
    good.PRODUCTION_ADMIN_ORIGIN,
  ]);
  assert.equal(
    runtimeConfiguration({ ...good, NAVIGATION_HANDOFF_ENABLED: "false" })
      .navigationHandoffEnabled,
    false,
  );
});
test("all production configuration fields required", () => {
  for (const key of Object.keys(good)) {
    const e = { ...good };
    delete e[key];
    assert.throws(() => runtimeConfiguration(e));
  }
});
test("production rejects staging target, wrong host, TLS omission, test key and weak/reused secrets", () => {
  for (const p of [
    {
      DATABASE_URL: good.DATABASE_URL.replace(
        "magiccitydb_3334",
        "magiccity_db_staging",
      ),
    },
    { PRODUCTION_DATABASE_HOST: "other.prod.invalid" },
    { DATABASE_URL: good.DATABASE_URL.replace("?sslmode=require", "") },
    { STRIPE_SECRET_KEY: "sk_test_synthetic" },
    { JWT_SECRET: "short" },
    { NAVIGATION_HANDOFF_SECRET: good.JWT_SECRET },
    { STAGING_STORE_ORIGIN: "https://store.stage.invalid" },
    { STRIPE_API_VERSION: "2020-01-01" },
    { NODE_ENV: "test" },
    { NAVIGATION_HANDOFF_ENABLED: "yes" },
  ])
    assert.throws(() => runtimeConfiguration({ ...good, ...p }));
});
test("production rejects untrusted origins and altered literal return templates", () => {
  for (const p of [
    { PRODUCTION_STORE_ORIGIN: "https://user:pass@store.prod.invalid" },
    { PRODUCTION_STORE_ORIGIN: "https://store.prod.invalid/path" },
    { PRODUCTION_STORE_ORIGIN: "https://store.staging.invalid" },
    { CHECKOUT_APP_URL: good.CHECKOUT_APP_URL + "/" },
    {
      STRIPE_SUCCESS_URL: good.STRIPE_SUCCESS_URL.replace(
        "{ORDER_ID}",
        "arbitrary",
      ),
    },
    { STRIPE_CANCEL_URL: "https://evil.invalid/cancel" },
  ])
    assert.throws(() => runtimeConfiguration({ ...good, ...p }));
});
test("production readiness requires additive schema and uses a read-only transaction", async () => {
  const calls = [];
  const fake = (ready) => ({
    $transaction: async (fn) =>
      fn({
        $executeRawUnsafe: async (q) => calls.push(q),
        $queryRawUnsafe: async () => [{ ready }],
      }),
  });
  await requireProductionLegacyReadiness(fake(true));
  assert.ok(calls.includes("SET TRANSACTION READ ONLY"));
  await assert.rejects(
    requireProductionLegacyReadiness(fake(false)),
    /PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED/,
  );
  await assert.rejects(
    requireProductionLegacyReadiness({
      $transaction: async () => {
        throw Error("private database error");
      },
    }),
    /^Error: PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED$/,
  );
});
test("entry refuses failed readiness before app or Stripe import", async () => {
  let imported = false;
  const logs = [],
    process = { env: good, exitCode: 0 };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../dist/server"), "utf8"),
    {
      exports: {},
      process,
      Error,
      console: { error: (s) => logs.push(s) },
      require: (name) => {
        if (name === "dotenv/config") return {};
        if (name === "./runtimeConfiguration")
          return { runtimeConfiguration: () => runtimeConfiguration(good) };
        if (name === "./productionConfiguration")
          return {
            requireProductionLegacyReadiness: async () => {
              throw Error("PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED");
            },
          };
        imported = true;
        throw Error("unexpected app import");
      },
    },
  );
  await new Promise(setImmediate);
  assert.equal(imported, false);
  assert.equal(process.exitCode, 1);
  assert.deepEqual(logs, ["PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED"]);
});
test("production app rejects anonymous current and legacy orders, enforces CORS and test webhook denial without DB", async () => {
  const { createApp } = require("../dist/app"),
    c = runtimeConfiguration(good);
  const app = createApp({
    logging: false,
    production: true,
    orderAccessRequired: false,
    navigationHandoffEnabled: true,
    allowedOrigins: c.origins,
    handoffOrigins: c.handoffOrigins,
  });
  assert.equal(app.locals.orderAccessRequired, true);
  assert.equal(app.locals.shippingEnabled, true);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    for (const id of ["legacy-order", "new-order"])
      assert.equal(
        (await fetch(url + "/api/orders/" + id + "/min")).status,
        401,
      );
    assert.equal(
      (
        await fetch(url + "/healthz", {
          headers: { Origin: "https://store.staging.invalid" },
        })
      ).status,
      403,
    );
    for (const [route, origin, status] of [
      ["/api/orders/a/navigation-handoffs", good.PRODUCTION_STORE_ORIGIN, 204],
      ["/api/navigation-handoffs/redeem", good.PRODUCTION_CHECKOUT_ORIGIN, 204],
      ["/api/navigation-handoffs/redeem", good.PRODUCTION_STORE_ORIGIN, 403],
    ])
      assert.equal(
        (
          await fetch(url + route, {
            method: "OPTIONS",
            headers: { Origin: origin },
          })
        ).status,
        status,
      );
    const Stripe = require("stripe"),
      signer = new Stripe("sk_test_synthetic");
    for (const live of [true, false]) {
      const body = JSON.stringify({
          id: "evt_synthetic",
          type: "synthetic.ignored",
          livemode: live,
          data: { object: {} },
        }),
        sig = signer.webhooks.generateTestHeaderString({
          payload: body,
          secret: process.env.STRIPE_WEBHOOK_SECRET,
        });
      assert.equal(
        (
          await fetch(url + "/api/stripe/webhook", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Stripe-Signature": sig,
            },
            body,
          })
        ).status,
        live ? 200 : 400,
      );
    }
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
test("creation kill switch leaves issued-ticket redemption available", async () => {
  const { createApp } = require("../dist/app"),
    c = runtimeConfiguration(good);
  const app = createApp({
    logging: false,
    production: true,
    navigationHandoffEnabled: false,
    allowedOrigins: c.origins,
    handoffOrigins: c.handoffOrigins,
  });
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const url = "http://127.0.0.1:" + s.address().port;
  try {
    assert.equal(
      (
        await fetch(url + "/api/orders/a/navigation-handoffs", {
          method: "OPTIONS",
          headers: { Origin: good.PRODUCTION_STORE_ORIGIN },
        })
      ).status,
      503,
    );
    assert.equal(
      (
        await fetch(url + "/api/navigation-handoffs/redeem", {
          method: "OPTIONS",
          headers: { Origin: good.PRODUCTION_CHECKOUT_ORIGIN },
        })
      ).status,
      204,
    );
  } finally {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
});

test("production authorizes only an active grant for the exact order using mock persistence", async () => {
  const { createApp } = require("../dist/app"),
    c = runtimeConfiguration(good),
    app = createApp({
      logging: false,
      production: true,
      allowedOrigins: c.origins,
      handoffOrigins: c.handoffOrigins,
    });
  const s = app.listen(0, "127.0.0.1");
  await new Promise((r) => s.once("listening", r));
  const base = "http://127.0.0.1:" + s.address().port;
  const headers = { "Order-Access-Token": "a".repeat(43) };
  try {
    assert.equal(
      (await fetch(base + "/api/orders/authorized-order/min", { headers }))
        .status,
      200,
    );
    assert.equal(
      (await fetch(base + "/api/orders/other-order/min", { headers })).status,
      401,
    );
    grant = { ...grant, revokedAt: new Date() };
    assert.equal(
      (await fetch(base + "/api/orders/authorized-order/min", { headers }))
        .status,
      401,
    );
    grant = { ...grant, revokedAt: null, expiresAt: new Date(0) };
    assert.equal(
      (await fetch(base + "/api/orders/authorized-order/min", { headers }))
        .status,
      401,
    );
  } finally {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
});

test("production Stripe wrapper rejects TEST retrieved sessions without contacting Stripe", async () => {
  let live = false;
  class FakeStripe {
    constructor() {
      this.checkout = {
        sessions: {
          create: async () => ({ livemode: live }),
          retrieve: async () => ({ livemode: live }),
        },
      };
    }
  }
  const context = {
    exports: {},
    require: () => FakeStripe,
    process: {
      env: {
        DEPLOYMENT_ENV: "production",
        STRIPE_SECRET_KEY: "sk_live_synthetic",
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../dist/services/stripeClient"), "utf8"),
    context,
  );
  await assert.rejects(
    context.exports.stripe.checkout.sessions.retrieve("cs_test_synthetic"),
    /PRODUCTION_TEST_SESSION_DENIED/,
  );
  live = true;
  assert.equal(
    (
      await context.exports.stripe.checkout.sessions.retrieve(
        "cs_live_synthetic",
      )
    ).livemode,
    true,
  );
});

test("both production creation endpoints require a key even with a prepared token", async () => {
  const { createApp } = require("../dist/app"),
    c = runtimeConfiguration(good),
    app = createApp({
      logging: false,
      production: true,
      allowedOrigins: c.origins,
      handoffOrigins: c.handoffOrigins,
    });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    for (const route of ["/orders", "/checkout/intent"]) {
      const r = await fetch(
        "http://127.0.0.1:" + server.address().port + "/api" + route,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Order-Access-Token": "a".repeat(43),
          },
          body: "{}",
        },
      );
      assert.equal(r.status, 400);
      assert.equal((await r.json()).error, "SECURE_ORDER_CREATION_REQUIRED");
    }
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

test("Stripe API version absent/empty/approved explicit is compatible, all others refuse", () => {
  const { SUPPORTED_STRIPE_API_VERSION } = require("../dist/stripeApiVersion");
  assert.equal(SUPPORTED_STRIPE_API_VERSION, require("stripe").API_VERSION);
  for (const value of [undefined, "", SUPPORTED_STRIPE_API_VERSION])
    assert.doesNotThrow(() =>
      runtimeConfiguration({ ...good, STRIPE_API_VERSION: value }),
    );
  for (const value of [
    "2020-01-01",
    " " + SUPPORTED_STRIPE_API_VERSION,
    SUPPORTED_STRIPE_API_VERSION + " ",
    "future",
  ])
    assert.throws(
      () => runtimeConfiguration({ ...good, STRIPE_API_VERSION: value }),
      /STRIPE_API_VERSION_INCOMPATIBLE/,
    );
});
