
CREATE TABLE "GuestOrderAccess" (
 "tokenHash" CHAR(64) PRIMARY KEY,
 "orderId" TEXT REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "GuestOrderAccess_orderId_idx" ON "GuestOrderAccess"("orderId");
CREATE TABLE "GuestOrderRecovery" (
 "tokenHash" CHAR(64) PRIMARY KEY,
 "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "GuestOrderRecovery_orderId_createdAt_idx" ON "GuestOrderRecovery"("orderId","createdAt");
