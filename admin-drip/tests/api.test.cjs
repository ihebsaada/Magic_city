const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  { buildSync } = require("esbuild"),
  path = require("node:path");
function client(response) {
  const store = new Map([
    [
      "admin_token",
      "a." +
        Buffer.from(
          JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        ).toString("base64url") +
        ".b",
    ],
    ["admin_user", "{}"],
  ]);
  let calls = 0;
  const bundle = buildSync({
    entryPoints: [path.join(__dirname, "../src/services/api.ts")],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    define: {
      "import.meta.env.VITE_BASE_API_URL": '"https://api.example.invalid/api"',
      "import.meta.env.PROD": "true",
    },
  }).outputFiles[0].text;
  const context = {
    exports: {},
    module: { exports: {} },
    localStorage: {
      getItem: (k) => store.get(k) || null,
      removeItem: (k) => store.delete(k),
    },
    window: { dispatchEvent() {} },
    Event: class {},
    atob: (s) => Buffer.from(s, "base64").toString(),
    fetch: async () => {
      calls++;
      if (response instanceof Error) throw response;
      return response;
    },
    Date,
    Error,
  };
  context.exports = context.module.exports;
  vm.runInNewContext(bundle, context);
  return { ...context.module.exports, store, calls: () => calls };
}
test("HTTP status errors preserve codes without clearing session except protected 401", async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429, 500]) {
    const api = client(
      new Response(
        JSON.stringify({
          error: status === 409 ? "STOCK_BELOW_RESERVATIONS" : "SYNTHETIC",
        }),
        { status },
      ),
    );
    await assert.rejects(
      api.apiGet("/admin/products"),
      (e) =>
        e.status === status &&
        (status !== 409 || /reserved stock/.test(e.message)),
    );
    assert.equal(api.store.has("admin_token"), status !== 401);
  }
});
test("204 succeeds without attempting JSON parsing", async () => {
  const api = client(new Response(null, { status: 204 }));
  assert.equal(await api.apiDelete("/admin/products/1"), null);
});
test("HTML errors keep HTTP status and successful malformed JSON is rejected", async () => {
  const api = client(new Response("<html>error</html>", { status: 500 }));
  await assert.rejects(api.apiGet("/admin/products"), (e) => e.status === 500);
  const bad = client(new Response("not JSON"));
  await assert.rejects(
    bad.apiGet("/admin/products"),
    (e) => e.code === "INVALID_RESPONSE",
  );
});
test("network failure is explicit and never retries writes", async () => {
  const api = client(Error("synthetic disconnected"));
  await assert.rejects(
    api.apiPost("/admin/products", {}),
    (e) => e.code === "NETWORK_ERROR" && /not retried/.test(e.message),
  );
  assert.equal(api.calls(), 1);
});
test("login never attaches stale bearer and invalid credentials do not erase existing session", async () => {
  const api = client(new Response("{}", { status: 401 }));
  await assert.rejects(
    api.request("/admin/auth/login", "POST", {}, false),
    (e) => /Incorrect email/.test(e.message),
  );
  assert.equal(api.store.has("admin_token"), true);
});
test("expired and malformed token never reaches the API", async () => {
  for (const value of [
    "broken",
    "a." + Buffer.from('{"exp":1}').toString("base64url") + ".b",
  ]) {
    const api = client(new Response("{}"));
    api.store.set("admin_token", value);
    await assert.rejects(
      api.apiGet("/admin/products"),
      (e) => e.status === 401,
    );
    assert.equal(api.calls(), 0);
    assert.equal(api.store.has("admin_token"), false);
  }
});
