-- Additive: existing orders and their amounts are not updated.
CREATE TABLE "OrderIdempotency" (
  "keyHash" CHAR(64) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "endpoint" TEXT NOT NULL,
  "orderId" TEXT,
  "response" JSONB,
  "statusCode" INTEGER NOT NULL DEFAULT 201,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replayUntil" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderIdempotency_pkey" PRIMARY KEY ("keyHash")
);
CREATE UNIQUE INDEX "OrderIdempotency_orderId_key" ON "OrderIdempotency"("orderId");
ALTER TABLE "OrderIdempotency" ADD CONSTRAINT "OrderIdempotency_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
