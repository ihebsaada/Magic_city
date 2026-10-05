
CREATE TABLE "PaymentAttempt" (
"id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "generation" INTEGER NOT NULL,
"idempotencyKey" TEXT NOT NULL, "request" JSONB NOT NULL, "amountCents" INTEGER NOT NULL,
"currency" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'CREATING', "sessionId" TEXT, "sessionUrl" TEXT,
"leaseOwner" TEXT, "leaseUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
CONSTRAINT "PaymentAttempt_amount_check" CHECK ("amountCents" >= 50),
CONSTRAINT "PaymentAttempt_generation_check" CHECK ("generation" > 0),
CONSTRAINT "PaymentAttempt_state_check" CHECK ("state" IN ('CREATING','ACTIVE','EXPIRED','PAID')));
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentAttempt_sessionId_key" ON "PaymentAttempt"("sessionId");
CREATE UNIQUE INDEX "PaymentAttempt_orderId_generation_key" ON "PaymentAttempt"("orderId","generation");
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "PaymentFinalization" ("orderId" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PaymentFinalization_pkey" PRIMARY KEY ("orderId"));
CREATE UNIQUE INDEX "PaymentFinalization_sessionId_key" ON "PaymentFinalization"("sessionId");
ALTER TABLE "PaymentFinalization" ADD CONSTRAINT "PaymentFinalization_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "StripeEvent" ("id" TEXT NOT NULL, "type" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id"));
