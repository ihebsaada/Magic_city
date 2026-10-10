-- Additive. Intentionally no backfill and no changes to historical orders/items.
CREATE TABLE "SecureOrderPolicy" (
 "orderId" TEXT NOT NULL,
 "policyVersion" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SecureOrderPolicy_pkey" PRIMARY KEY ("orderId"),
 CONSTRAINT "SecureOrderPolicy_version_check" CHECK ("policyVersion" = 1),
 CONSTRAINT "SecureOrderPolicy_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
