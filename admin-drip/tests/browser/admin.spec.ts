import { test, expect, type Page } from "@playwright/test";
const token = (exp = Math.floor(Date.now() / 1000) + 3600) =>
  "synthetic." +
  Buffer.from(
    JSON.stringify({
      exp,
      sub: "synthetic-admin",
      email: "operator@example.invalid",
    }),
  ).toString("base64url") +
  ".synthetic";
const user = { id: "synthetic-admin", email: "operator@example.invalid" };
const originalProduct = () => ({
  id: 1,
  title: "Synthetic product",
  handle: "synthetic-product",
  vendor: null,
  productType: null,
  status: null,
  option1Name: null,
  option2Name: null,
  option3Name: null,
  tags: [],
  images: [{ id: 1, src: "https://images.example.invalid/original.jpg" }],
  collections: [
    { id: 1, title: "Collection A", handle: "collection-a", productsCount: 1 },
  ],
  variants: [
    {
      id: 11,
      title: "Small",
      sku: "S",
      price: "10.00",
      compareAtPrice: null,
      inventoryQuantity: 8,
      reservedQuantity: 2,
    },
    {
      id: 12,
      title: "Large",
      sku: "L",
      price: "20.00",
      compareAtPrice: null,
      inventoryQuantity: 4,
      reservedQuantity: 1,
    },
  ],
});
type Write = { method: string; path: string; body: Record<string, unknown> };
async function setup(
  page: Page,
  options: {
    auth?: boolean;
    expired?: boolean;
    reject?: number;
    collectionFail?: boolean;
    orderModern?: boolean;
  } = {},
) {
  let product = originalProduct();
  const writes: Write[] = [],
    external: string[] = [];
  await page.context().route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.origin !== "http://127.0.0.1:5185") {
      external.push(url.origin);
      return route.abort();
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname.slice(4),
      method = req.method();
    const body = req.postDataJSON() || {};
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (method !== "GET") writes.push({ method, path, body });
    if (path === "/admin/auth/login")
      return options.reject
        ? reply({ error: "Invalid credentials" }, options.reject)
        : reply({ token: token(), user });
    if (options.reject)
      return reply(
        {
          error:
            options.reject === 409
              ? "STOCK_BELOW_RESERVATIONS"
              : "Synthetic error",
        },
        options.reject,
      );
    if (path === "/admin/products/1/collections")
      return options.collectionFail
        ? reply({ error: "COLLECTION_NOT_FOUND" }, 422)
        : reply({ ok: true });
    if (path === "/admin/products/1" && method === "PATCH") {
      const variant = body.variantUpdate as Record<string, unknown> | undefined;
      product = {
        ...product,
        ...body,
        variants: product.variants.map((v) =>
          v.id === variant?.variantId ? { ...v, ...variant } : v,
        ),
      };
      return reply(product);
    }
    if (path === "/admin/products")
      return method === "POST"
        ? reply({ ...product, id: 2 }, 201)
        : reply([product]);
    if (path === "/admin/products/1") return reply(product);
    if (path === "/admin/collections")
      return reply([
        {
          id: 1,
          title: "Collection A",
          handle: "collection-a",
          productsCount: 1,
        },
        {
          id: 2,
          title: "Collection B",
          handle: "collection-b",
          productsCount: 0,
        },
      ]);
    if (path.startsWith("/admin/collections/"))
      return reply({
        collection: {
          id: 1,
          title: "Collection A",
          handle: "collection-a",
          productsCount: 1,
        },
        products: [product],
      });
    if (path === "/admin/orders")
      return reply([
        {
          id: "order-1",
          orderNumber: "#1",
          customer: {
            name: "Synthetic customer",
            email: "customer@example.invalid",
          },
          total: "20.00",
          currency: "EUR",
          status: "pending",
          paymentStatus: "pending",
          createdAt: "2026-10-12T10:00:00Z",
        },
      ]);
    if (path === "/admin/orders/order-1")
      return method === "PATCH"
        ? reply({ ok: true })
        : reply({
            id: "order-1",
            orderNumber: "#1",
            customer: {
              name: "Synthetic customer",
              email: "customer@example.invalid",
            },
            total: "20.00",
            currency: "EUR",
            status: "pending",
            paymentStatus: "pending",
            createdAt: "2026-10-12T10:00:00Z",
            shipping: {},
            items: [],
            canEdit: !!options.orderModern,
            readOnlyReason: options.orderModern
              ? null
              : {
                  code: "HISTORICAL_ORDER_READ_ONLY",
                  message: "Historical orders are read-only.",
                },
            allowedStatuses: options.orderModern
              ? ["pending", "processing", "shipped", "delivered", "cancelled"]
              : [],
          });
    if (path === "/admin/discounts")
      return method === "GET"
        ? reply([
            {
              id: "discount-1",
              code: "SYNTHETIC",
              type: "percentage",
              value: 10,
              usageCount: 2,
              reservedUses: 3,
              usageLimit: 10,
              expiresAt: "2030-01-02T13:14:15.123Z",
              active: true,
            },
          ])
        : reply({ id: "new-discount" }, 201);
    if (path.startsWith("/admin/discounts/")) return reply({ ok: true });
    return reply({ error: "Unknown synthetic route" }, 404);
  });
  if (options.auth !== false)
    await page.addInitScript(
      ({ user, token }) => {
        localStorage.setItem("admin_token", token);
        localStorage.setItem("admin_user", JSON.stringify(user));
      },
      { user, token: token(options.expired ? 1 : undefined) },
    );
  return { writes, external };
}
test("anonymous routes redirect and login uses email without admin substring", async ({
  page,
}) => {
  const { writes } = await setup(page, { auth: false });
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  expect(writes[0]).toMatchObject({
    path: "/admin/auth/login",
    body: { email: user.email },
  });
});
test("invalid login shows credentials error without claiming email substring policy", async ({
  page,
}) => {
  await setup(page, { auth: false, reject: 401 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Incorrect email or password.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/containing 'admin'/)).toHaveCount(0);
});
test("expired JWT redirects without protected requests", async ({ page }) => {
  await setup(page, { expired: true });
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem("admin_token")),
  ).toBeNull();
});
test("protected 401 clears session and redirects", async ({ page }) => {
  await setup(page, { reject: 401 });
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem("admin_user")),
  ).toBeNull();
});
test("business 409 keeps session and renders useful error", async ({
  page,
}) => {
  await setup(page, { reject: 409 });
  await page.goto("/admin/products");
  await expect(page.getByText(/Physical stock cannot be lower/)).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem("admin_token"))).toBe(
    true,
  );
});
test("detail Save Changes sends only edited metadata", async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto("/admin/products/1");
  await page.getByLabel("Title", { exact: true }).fill("Updated title");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByText("Product saved successfully.", { exact: true }),
  ).toBeVisible();
  expect(writes.filter((w) => w.method === "PATCH")[0].body).toEqual({
    title: "Updated title",
  });
});
test("multi-variant editor requires selection and updates only selected variant", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/admin/products/1");
  await page.getByRole("button", { name: "Edit product", exact: true }).click();
  await expect(page.getByLabel("Price *", { exact: true })).toBeDisabled();
  await page.getByLabel("Variant to edit").selectOption("12");
  await expect(page.getByLabel("Price *", { exact: true })).toHaveValue(
    "20.00",
  );
  await expect(
    page.getByText(/Physical: 4.*Reserved: 1.*Available: 3/),
  ).toBeVisible();
  await page.getByLabel("Stock", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Product updated successfully.", { exact: true }),
  ).toBeVisible();
  expect(writes[0].body).toEqual({
    variantUpdate: { variantId: 12, inventoryQuantity: 3 },
  });
});
test("invalid fractional stock does not issue writes", async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto("/admin/products/1");
  await page.getByRole("button", { name: "Edit product", exact: true }).click();
  await page.getByLabel("Variant to edit").selectOption("12");
  await page.getByLabel("Stock", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Stock must be a non-negative whole number."),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
});
test("collection-only save calls dedicated PUT and preserves other associations", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/admin/products/1");
  await page.getByRole("button", { name: "Edit product", exact: true }).click();
  await page.getByRole("button", { name: "Collection B", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Product updated successfully.", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([
    {
      method: "PUT",
      path: "/admin/products/1/collections",
      body: { collectionIds: [1, 2] },
    },
  ]);
});
test("partial association failure reports saved metadata and no false success", async ({
  page,
}) => {
  const { writes } = await setup(page, { collectionFail: true });
  await page.goto("/admin/products/1");
  await page.getByRole("button", { name: "Edit product", exact: true }).click();
  await page.getByLabel("Title *", { exact: true }).fill("Changed");
  await page.getByRole("button", { name: "Collection B", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page
      .getByLabel("Notifications (F8)")
      .getByText(
        /Product and selected variant saved, but collections were not saved/,
      ),
  ).toBeVisible();
  await expect(
    page.getByText("Product updated successfully.", { exact: true }),
  ).toHaveCount(0);
  expect(writes.map((w) => w.method)).toEqual(["PATCH", "PUT"]);
});
test("historical order is visible and read-only, payment has no editing control", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/orders");
  await page.getByText("#1", { exact: true }).click();
  await expect(
    page.getByText("Historical orders are read-only."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Payment status is read-only/)).toBeVisible();
});
test("modern order writes status only", async ({ page }) => {
  const { writes } = await setup(page, { orderModern: true });
  await page.goto("/admin/orders");
  await page.getByText("#1", { exact: true }).click();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "processing", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({ status: "PROCESSING" });
});
test("discount reservations visible and unchanged exact expiration omitted from PATCH", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto("/admin/discounts");
  await expect(page.getByText("2 used + 3 reserved / 10")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Discount value").fill("11");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({ value: 11 });
});
test("collections detail, nullable product data and EUR remain visible", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/admin/collections/collection-a");
  await expect(
    page.getByRole("heading", { name: "Collection A", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("€10.00 – €20.00", { exact: true }),
  ).toBeVisible();
});
