CREATE TABLE "NavigationHandoff" (
 "ticketHash" CHAR(64) NOT NULL, "creationKeyHash" CHAR(64) NOT NULL,
 "requestHash" CHAR(64) NOT NULL, "ticketCiphertext" TEXT NOT NULL,
 "orderId" TEXT NOT NULL, "sourceHash" CHAR(64) NOT NULL, "recipientHash" CHAR(64),
 "checkoutOrigin" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "redeemedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "NavigationHandoff_pkey" PRIMARY KEY ("ticketHash"),
 CONSTRAINT "NavigationHandoff_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "NavigationHandoff_sourceHash_fkey" FOREIGN KEY ("sourceHash") REFERENCES "GuestOrderAccess"("tokenHash") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "NavigationHandoff_recipientHash_fkey" FOREIGN KEY ("recipientHash") REFERENCES "GuestOrderAccess"("tokenHash") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NavigationHandoff_creationKeyHash_key" ON "NavigationHandoff"("creationKeyHash");
CREATE INDEX "NavigationHandoff_orderId_createdAt_idx" ON "NavigationHandoff"("orderId", "createdAt");
