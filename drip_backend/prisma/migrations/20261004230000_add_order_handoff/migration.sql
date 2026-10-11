CREATE TABLE "OrderHandoff" (
 "id" TEXT PRIMARY KEY,
 "expectedOrderId" TEXT NOT NULL,
 "recipientHash" CHAR(64) NOT NULL UNIQUE REFERENCES "GuestOrderAccess"("tokenHash") ON DELETE RESTRICT,
 "origin" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "approvedAt" TIMESTAMP(3),
 "redeemedAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OrderHandoff_expectedOrderId_createdAt_idx" ON "OrderHandoff"("expectedOrderId","createdAt");
