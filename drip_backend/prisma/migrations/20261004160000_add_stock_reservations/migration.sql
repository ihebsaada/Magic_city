
ALTER TABLE "Variant" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Discount" ADD COLUMN "reservedUses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_reservations_check"
 CHECK ("reservedQuantity">=0 AND COALESCE("inventoryQuantity",0)>="reservedQuantity") NOT VALID;
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_reservedUses_check" CHECK ("reservedUses">=0 AND "usageCount">=0 AND ("usageLimit" IS NULL OR "usageLimit">="usageCount"+"reservedUses")) NOT VALID;
CREATE TABLE "OrderReservation" (
 "orderId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'ACTIVE',
 "expiresAt" TIMESTAMP(3) NOT NULL, "discountId" TEXT, "reconciliationReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OrderReservation_pkey" PRIMARY KEY ("orderId"),
 CONSTRAINT "OrderReservation_state_check" CHECK ("state" IN ('ACTIVE','CONSUMED','RELEASED')));
CREATE INDEX "OrderReservation_state_expiresAt_idx" ON "OrderReservation"("state","expiresAt");
ALTER TABLE "OrderReservation" ADD CONSTRAINT "OrderReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderReservation" ADD CONSTRAINT "OrderReservation_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "StockReservationItem" ("orderId" TEXT NOT NULL,"variantId" INTEGER NOT NULL,"quantity" INTEGER NOT NULL,
 CONSTRAINT "StockReservationItem_pkey" PRIMARY KEY ("orderId","variantId"),
 CONSTRAINT "StockReservationItem_quantity_check" CHECK ("quantity">0 AND "quantity"<=99));
CREATE INDEX "StockReservationItem_variantId_idx" ON "StockReservationItem"("variantId");
ALTER TABLE "StockReservationItem" ADD CONSTRAINT "StockReservationItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderReservation"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservationItem" ADD CONSTRAINT "StockReservationItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
