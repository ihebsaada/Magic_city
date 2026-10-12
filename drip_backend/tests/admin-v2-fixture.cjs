const assert = require("node:assert/strict");
assert.match(
  process.env.DATABASE_URL || "",
  /^postgresql:\/\/lot4_test@127\.0\.0\.1:\d+\/lot4_isolated$/,
);
const { PrismaClient } = require("@prisma/client"),
  db = new PrismaClient();
(async () => {
  // Prisma schema push omits SQL CHECK constraints. Reproduce them only in this fresh disposable schema.
  for (const sql of [
    'ALTER TABLE "Variant" ADD CONSTRAINT "Variant_reservations_check" CHECK ("reservedQuantity">=0 AND COALESCE("inventoryQuantity",0)>="reservedQuantity") NOT VALID',
    'ALTER TABLE "Discount" ADD CONSTRAINT "Discount_reservedUses_check" CHECK ("reservedUses">=0 AND "usageCount">=0 AND ("usageLimit" IS NULL OR "usageLimit">="usageCount"+"reservedUses")) NOT VALID',
    "ALTER TABLE \"OrderReservation\" ADD CONSTRAINT \"OrderReservation_state_check\" CHECK (\"state\" IN ('ACTIVE','CONSUMED','RELEASED'))",
    'ALTER TABLE "StockReservationItem" ADD CONSTRAINT "StockReservationItem_quantity_check" CHECK ("quantity">0 AND "quantity"<=99)',
    'ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_amount_check" CHECK ("amountCents">=50)',
    'ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_generation_check" CHECK ("generation">0)',
    "ALTER TABLE \"PaymentAttempt\" ADD CONSTRAINT \"PaymentAttempt_state_check\" CHECK (\"state\" IN ('CREATING','ACTIVE','EXPIRED','PAID'))",
    'ALTER TABLE "SecureOrderPolicy" ADD CONSTRAINT "SecureOrderPolicy_version_check" CHECK ("policyVersion"=1)',
    'ALTER TABLE "HistoricalWebhookReceipt" ADD CONSTRAINT "HistoricalWebhookReceipt_decision_check" CHECK ("decision"=\'HISTORICAL_QUARANTINED\')',
    'ALTER TABLE "HistoricalWebhookReceipt" ADD CONSTRAINT "HistoricalWebhookReceipt_review_check" CHECK ("reviewState" IN (\'PENDING\',\'REVIEWED\'))',
    'ALTER TABLE "HistoricalWebhookReceipt" ADD CONSTRAINT "HistoricalWebhookReceipt_severity_check" CHECK ("severity" IN (\'WARNING\',\'CRITICAL\'))',
  ])
    await db.$executeRawUnsafe(sql);
  await db.order.create({
    data: {
      id: "legacy-before-migration",
      customerName: "Legacy Synthetic",
      customerEmail: "legacy@example.invalid",
      total: "12.34",
      currency: "EUR",
    },
  });
  const p = await db.product.create({
    data: {
      handle: "legacy-stock-before-migration",
      title: "Legacy Synthetic Stock",
      variants: {
        create: [
          { price: 20, sku: "legacy-synthetic-999", inventoryQuantity: 999 },
          { price: 20, inventoryQuantity: null },
          { price: 20, inventoryQuantity: 0 },
        ],
      },
    },
    include: { variants: true },
  });
  await db.orderItem.create({
    data: {
      orderId: "legacy-before-migration",
      productId: p.id,
      productTitle: p.title,
      productHandle: p.handle,
      quantity: 1,
      unitPrice: "12.34",
      variantSku: "legacy-synthetic-999",
    },
  });
})()
  .catch((error) => {
    console.error(error.code || error.name);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
