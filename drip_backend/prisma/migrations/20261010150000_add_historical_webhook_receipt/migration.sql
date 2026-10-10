-- Transport quarantine only. No historical backfill or commerce mutation.
CREATE TABLE "HistoricalWebhookReceipt" (
 "eventHash" CHAR(64) NOT NULL PRIMARY KEY,
 "payloadHash" CHAR(64) NOT NULL,
 "orderAlias" CHAR(64) NOT NULL,
 "sessionHash" CHAR(64) NOT NULL,
 "eventType" TEXT NOT NULL,
 "livemode" BOOLEAN NOT NULL,
 "decision" TEXT NOT NULL DEFAULT 'HISTORICAL_QUARANTINED',
 "reviewState" TEXT NOT NULL DEFAULT 'PENDING',
 "severity" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HistoricalWebhookReceipt_decision_check" CHECK ("decision"='HISTORICAL_QUARANTINED'),
 CONSTRAINT "HistoricalWebhookReceipt_review_check" CHECK ("reviewState" IN ('PENDING','REVIEWED')),
 CONSTRAINT "HistoricalWebhookReceipt_severity_check" CHECK ("severity" IN ('WARNING','CRITICAL'))
);
CREATE INDEX "HistoricalWebhookReceipt_reviewState_createdAt_idx" ON "HistoricalWebhookReceipt"("reviewState","createdAt");
