const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
assert.match(
  process.env.DATABASE_URL || "",
  /^postgresql:\/\/lot4_test@127\.0\.0\.1:\d+\/lot4_isolated$/,
);
class FakeStripe {
  constructor() {
    this.checkout = {
      sessions: {
        create() {
          throw Error("External payment forbidden");
        },
        retrieve() {
          throw Error("External payment forbidden");
        },
      },
    };
  }
}
require.cache[require.resolve("stripe")] = { exports: FakeStripe };
const { PrismaClient } = require("@prisma/client"),
  db = new PrismaClient(),
  shared = require("../dist/prisma").default,
  { createApp } = require("../dist/app");
let server, base, token, product, collections, legacy, modern, legacyBefore;
async function api(method, path, body, auth = token) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(auth ? { Authorization: "Bearer " + auth } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
before(async () => {
  const user = await db.user.create({
    data: {
      email: "admin-v2-" + crypto.randomUUID() + "@example.invalid",
      passwordHash: await require("bcrypt").hash("synthetic-password", 4),
    },
  });
  token = require("jsonwebtoken").sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  collections = await Promise.all(
    [1, 2].map((n) =>
      db.collection.create({
        data: {
          handle: "admin-v2-" + n + "-" + crypto.randomUUID(),
          title: "Synthetic collection " + n,
        },
      }),
    ),
  );
  product = await db.product.create({
    data: {
      handle: "admin-v2-" + crypto.randomUUID(),
      title: "Synthetic product",
      vendor: "Original",
      images: {
        create: [
          { src: "https://images.example.invalid/original.jpg", position: 1 },
        ],
      },
      variants: {
        create: [
          {
            price: 10,
            sku: "admin-v2-a-" + crypto.randomUUID(),
            inventoryQuantity: 10,
          },
          {
            price: 20,
            sku: "admin-v2-b-" + crypto.randomUUID(),
            inventoryQuantity: 8,
            reservedQuantity: 2,
          },
        ],
      },
      collections: { create: { collectionId: collections[0].id } },
    },
    include: { variants: { orderBy: { id: "asc" } }, images: true },
  });
  legacy = await db.order.create({
    data: {
      customerName: "Synthetic legacy",
      customerEmail: "legacy-admin@example.invalid",
      total: 12.34,
      currency: "EUR",
    },
  });
  legacyBefore = await db.order.findUnique({ where: { id: legacy.id } });
  modern = await db.order.create({
    data: {
      customerName: "Synthetic modern",
      customerEmail: "modern-admin@example.invalid",
      total: 20,
      currency: "EUR",
      securePolicy: { create: { policyVersion: 1 } },
      reservation: {
        create: {
          state: "ACTIVE",
          expiresAt: new Date(Date.now() + 3600000),
          items: { create: { variantId: product.variants[1].id, quantity: 1 } },
        },
      },
    },
  });
  server = createApp({ logging: false }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  const login = await api(
    "POST",
    "/admin/auth/login",
    { email: user.email, password: "synthetic-password" },
    null,
  );
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, user.id);
  assert.equal(typeof login.body.token, "string");
});
after(async () => {
  assert.deepEqual(
    await db.order.findUnique({ where: { id: legacy.id } }),
    legacyBefore,
  );
  server?.closeAllConnections();
  await new Promise((r) => server.close(r));
  await shared.$disconnect();
  await db.$disconnect();
});
test("login rejects invalid credentials and malformed inputs", async () => {
  assert.equal(
    (
      await api(
        "POST",
        "/admin/auth/login",
        { email: "missing@example.invalid", password: "wrong" },
        null,
      )
    ).status,
    401,
  );
  assert.equal(
    (await api("POST", "/admin/auth/login", { email: [], password: {} }, null))
      .status,
    400,
  );
});
test("all admin contract routes reject anonymous access", async () => {
  for (const [method, path, body] of [
    ["GET", "/admin/products"],
    ["POST", "/admin/products", {}],
    ["GET", "/admin/products/1"],
    ["PATCH", "/admin/products/1", {}],
    ["DELETE", "/admin/products/1"],
    ["PATCH", "/admin/products/1/default-variant", {}],
    ["GET", "/admin/collections"],
    ["POST", "/admin/collections", {}],
    ["GET", "/admin/collections/test"],
    ["PATCH", "/admin/collections/1", {}],
    ["DELETE", "/admin/collections/1"],
    ["GET", "/admin/discounts"],
    ["POST", "/admin/discounts", {}],
    ["PATCH", "/admin/discounts/test", {}],
    ["DELETE", "/admin/discounts/test"],
    ["GET", "/admin/orders"],
    ["GET", "/admin/orders/test"],
    ["PATCH", "/admin/orders/test", {}],
    ["PUT", "/admin/products/1/collections", {}],
  ])
    assert.equal(
      (await api(method, path, body, null)).status,
      401,
      method + " " + path,
    );
});
test("product list/search/detail retain array and nullable decimal contracts", async () => {
  const list = await api("GET", "/admin/products?search=Synthetic%20product");
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body));
  assert.ok(list.body.some((p) => p.id === product.id));
  const detail = await api("GET", "/admin/products/" + product.id);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.variants[1].reservedQuantity, 2);
  assert.equal(typeof detail.body.variants[0].price, "string");
  assert.equal(detail.body.collections[0].id, collections[0].id);
  assert.equal((await api("GET", "/admin/products/1.5")).status, 400);
});
test("product metadata and explicitly selected variant save atomically without changing other variant", async () => {
  const first = await db.variant.findUnique({
    where: { id: product.variants[0].id },
  });
  const r = await api("PATCH", "/admin/products/" + product.id, {
    vendor: null,
    option1Name: "Size",
    variantUpdate: {
      variantId: product.variants[1].id,
      price: 21,
      sku: null,
      inventoryQuantity: 7,
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.vendor, null);
  assert.deepEqual(
    await db.variant.findUnique({ where: { id: first.id } }),
    first,
  );
  assert.equal(
    (await db.variant.findUnique({ where: { id: product.variants[1].id } }))
      .reservedQuantity,
    2,
  );
});
test("reservation conflict rolls product and images back", async () => {
  const before = await db.product.findUnique({
    where: { id: product.id },
    include: { images: true },
  });
  const r = await api("PATCH", "/admin/products/" + product.id, {
    title: "Must roll back",
    images: [],
    variantUpdate: { variantId: product.variants[1].id, inventoryQuantity: 0 },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, "STOCK_BELOW_RESERVATIONS");
  assert.deepEqual(
    await db.product.findUnique({
      where: { id: product.id },
      include: { images: true },
    }),
    before,
  );
});
test("late uniqueness failure rolls images and selected variant back", async () => {
  const other = await db.product.create({
    data: { title: "Collision", handle: "collision-" + crypto.randomUUID() },
  });
  const before = await db.product.findUnique({
    where: { id: product.id },
    include: { images: true, variants: true },
  });
  const r = await api("PATCH", "/admin/products/" + product.id, {
    handle: other.handle,
    images: ["https://images.example.invalid/new.jpg"],
    variantUpdate: { variantId: product.variants[1].id, price: 25 },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, "DUPLICATE_VALUE");
  assert.deepEqual(
    await db.product.findUnique({
      where: { id: product.id },
      include: { images: true, variants: true },
    }),
    before,
  );
});
test("image URLs validate, unchanged images keep identifiers and explicit empty list clears", async () => {
  const before = await db.productImage.findMany({
    where: { productId: product.id },
  });
  assert.equal(
    (
      await api("PATCH", "/admin/products/" + product.id, {
        images: ["javascript:bad"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("PATCH", "/admin/products/" + product.id, {
        images: before.map((i) => i.src),
      })
    ).status,
    200,
  );
  assert.deepEqual(
    await db.productImage.findMany({ where: { productId: product.id } }),
    before,
  );
  assert.equal(
    (await api("PATCH", "/admin/products/" + product.id, { images: [] }))
      .status,
    200,
  );
  assert.equal(
    await db.productImage.count({ where: { productId: product.id } }),
    0,
  );
});
test("collection replacement persists explicit IDs and invalid replacement preserves links", async () => {
  const path = "/admin/products/" + product.id + "/collections";
  assert.equal(
    (await api("PUT", path, { collectionIds: collections.map((c) => c.id) }))
      .status,
    200,
  );
  const before = await db.productCollection.findMany({
    where: { productId: product.id },
    orderBy: { collectionId: "asc" },
  });
  assert.equal(before.length, 2);
  assert.equal(
    (await api("PUT", path, { collectionIds: [2147483647] })).status,
    422,
  );
  assert.deepEqual(
    await db.productCollection.findMany({
      where: { productId: product.id },
      orderBy: { collectionId: "asc" },
    }),
    before,
  );
  assert.equal(
    (
      await api("PATCH", "/admin/products/" + product.id, {
        collectionIds: collections.map((c) => c.id),
      })
    ).status,
    200,
  );
  assert.equal((await api("PUT", path, { collectionIds: [-1] })).status, 400);
  assert.equal(
    (await api("PUT", path, { collectionIds: [collections[0].id] })).status,
    200,
  );
});
test("create/read/update/delete product and default variant preserve status contracts", async () => {
  const created = await api("POST", "/admin/products", {
    title: "Created",
    handle: "created-" + crypto.randomUUID(),
    price: 15,
    inventoryQuantity: 0,
    images: [],
    collectionIds: [collections[0].id],
  });
  assert.equal(created.status, 201);
  const id = created.body.id,
    v = created.body.variants[0];
  assert.equal(
    (
      await api("PATCH", "/admin/products/" + id + "/default-variant", {
        variantId: v.id,
        price: 16,
        sku: null,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api("PATCH", "/admin/products/" + id + "/default-variant", {
        variantId: 2147483647,
        price: 16,
      })
    ).status,
    404,
  );
  assert.equal((await api("DELETE", "/admin/products/" + id)).status, 204);
  assert.equal((await api("GET", "/admin/products/" + id)).status, 404);
  assert.equal(
    (await api("DELETE", "/admin/products/" + product.id)).status,
    409,
  );
});
test("collection CRUD and encoded handle retain read and 204 contracts", async () => {
  const c = await api("POST", "/admin/collections", {
    title: "Synthetic",
    handle: "special & " + crypto.randomUUID(),
    description: null,
  });
  assert.equal(c.status, 201);
  assert.ok(Array.isArray((await api("GET", "/admin/collections")).body));
  assert.equal(
    (
      await api(
        "GET",
        "/admin/collections/" + encodeURIComponent(c.body.handle),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await api("PATCH", "/admin/collections/" + c.body.id, {
        description: "Updated",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await api("POST", "/admin/collections", {
        title: "Duplicate",
        handle: c.body.handle,
      })
    ).status,
    409,
  );
  assert.equal(
    (await api("DELETE", "/admin/collections/" + c.body.id)).status,
    204,
  );
});
test("discount validations, exact timestamp, usage reservations, protected deletion and CRUD", async () => {
  for (const data of [
    { type: "bad", value: 5 },
    { type: "percentage", value: 101 },
    { type: "fixed", value: -1 },
    { type: "fixed", value: 1, usageLimit: 1.5 },
    { type: "fixed", value: 1, expiresAt: "bad" },
  ])
    assert.equal(
      (await api("POST", "/admin/discounts", { code: "INVALID", ...data }))
        .status,
      400,
    );
  const code = "ADMIN" + crypto.randomUUID(),
    expiresAt = "2030-01-02T13:14:15.123Z";
  const c = await api("POST", "/admin/discounts", {
    code,
    type: "percentage",
    value: 10,
    usageLimit: 10,
    expiresAt,
  });
  assert.equal(c.status, 201);
  const id = c.body.id;
  assert.equal(
    (await api("POST", "/admin/discounts", { code, type: "fixed", value: 1 }))
      .status,
    409,
  );
  await db.discount.update({ where: { id }, data: { reservedUses: 2 } });
  assert.equal(
    (await api("PATCH", "/admin/discounts/" + id, { usageLimit: 1 })).status,
    409,
  );
  assert.equal(
    (await api("PATCH", "/admin/discounts/" + id, { active: false })).status,
    200,
  );
  const d = (await api("GET", "/admin/discounts")).body.find(
    (d) => d.id === id,
  );
  assert.equal(d.expiresAt, expiresAt);
  assert.equal(d.reservedUses, 2);
  await db.orderReservation.update({
    where: { orderId: modern.id },
    data: { discountId: id },
  });
  assert.equal((await api("DELETE", "/admin/discounts/" + id)).status, 409);
  await db.orderReservation.update({
    where: { orderId: modern.id },
    data: { discountId: null },
  });
  assert.equal((await api("DELETE", "/admin/discounts/" + id)).status, 200);
});
test("historical capabilities fail closed; modern transitions match backend and do not change payment", async () => {
  const list = await api("GET", "/admin/orders");
  assert.ok(Array.isArray(list.body));
  const old = await api("GET", "/admin/orders/" + legacy.id);
  assert.equal(old.body.canEdit, false);
  assert.equal(old.body.readOnlyReason.code, "HISTORICAL_ORDER_READ_ONLY");
  assert.equal(
    (await api("PATCH", "/admin/orders/" + legacy.id, { status: "CANCELLED" }))
      .status,
    409,
  );
  const current = await api("GET", "/admin/orders/" + modern.id);
  assert.equal(current.body.canEdit, true);
  assert.ok(current.body.allowedStatuses.includes("processing"));
  assert.equal(
    (await api("PATCH", "/admin/orders/" + modern.id, { status: "SHIPPED" }))
      .status,
    200,
  );
  assert.equal(
    (await api("PATCH", "/admin/orders/" + modern.id, { status: "PENDING" }))
      .status,
    409,
  );
  assert.equal(
    (
      await api("PATCH", "/admin/orders/" + modern.id, {
        paymentStatus: "REFUNDED",
      })
    ).status,
    409,
  );
  assert.equal(
    (await db.order.findUnique({ where: { id: modern.id } })).paymentStatus,
    "PENDING",
  );
});
test("collection deletion rollback retains its existing associations", async () => {
  const c = await db.collection.create({
    data: {
      title: "Rollback synthetic",
      handle: "rollback-" + crypto.randomUUID(),
      products: { create: { productId: product.id } },
    },
  });
  await db.$executeRawUnsafe(
    `CREATE FUNCTION admin_v2_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER admin_v2_fail_delete BEFORE DELETE ON "Collection" FOR EACH ROW EXECUTE FUNCTION admin_v2_fail_delete()`,
  );
  try {
    assert.equal(
      (await api("DELETE", "/admin/collections/" + c.id)).status,
      500,
    );
    assert.ok(await db.collection.findUnique({ where: { id: c.id } }));
    assert.equal(
      await db.productCollection.count({ where: { collectionId: c.id } }),
      1,
    );
  } finally {
    await db.$executeRawUnsafe(
      'DROP TRIGGER admin_v2_fail_delete ON "Collection"',
    );
    await db.$executeRawUnsafe("DROP FUNCTION admin_v2_fail_delete()");
  }
});
test("monetary precision is validated and variant updates never implicitly create records", async () => {
  assert.equal(
    (
      await api("PATCH", "/admin/products/" + product.id + "/default-variant", {
        variantId: product.variants[0].id,
        price: 1.234,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("POST", "/admin/products", {
        title: "Invalid",
        handle: "invalid-" + crypto.randomUUID(),
        price: 1.234,
      })
    ).status,
    400,
  );
  const empty = await db.product.create({
    data: { title: "No variants", handle: "empty-" + crypto.randomUUID() },
  });
  assert.equal(
    (
      await api("PATCH", "/admin/products/" + empty.id + "/default-variant", {
        price: 10,
      })
    ).status,
    404,
  );
  assert.equal(await db.variant.count({ where: { productId: empty.id } }), 0);
});
