# Lot 4: order creation idempotency
## API
POST /api/checkout/intent and POST /api/orders accept optional Idempotency-Key. Without a key, legacy creation behavior and response bodies remain unchanged.
Keys are 16-128 ASCII letters/digits/underscore/hyphen. Future clients must generate crypto.randomUUID(), never use customer identifiers, and treat the key as confidential. The server stores SHA-256 of the key, not the raw value.
Successful creation/replay returns the original HTTP 201 and exact stored JSON response; Idempotency-Replayed reports false/true. Existing CORS preflight permits the request header; browser access to the response flag is not required.
Same key with a different normalized request or endpoint returns 409 IDEMPOTENCY_CONFLICT. Expired key returns 410 IDEMPOTENCY_EXPIRED. Retryable transaction conditions return 503 IDEMPOTENCY_RETRY. Always retry an uncertain outcome with the SAME key and unchanged request.
Canonical fingerprint v1 includes endpoint, validated customer fields, normalized code, bounded shipping fields, and sorted/aggregated requested option lines. Ignored client prices/unknown fields do not affect it. It does not incorporate mutable database prices or deployment URLs: replay must return the original outcome.
Validation failures roll back the claim. A key never deduplicates a distinct key, even for identical purchases.
## Persistence and migration
20261003120000_add_order_idempotency creates OrderIdempotency with a hashed key primary key, request hash, unique optional order relation, response JSON, HTTP status, creation timestamp and replay deadline. No existing order is updated.
A transaction claims the unique key, validates/prices through its transaction client, creates the order/items, and stores its response. Concurrent inserts serialize on the PostgreSQL uniqueness constraint. A failed transaction leaves neither a key claim nor an order.
Persisted response can be replayed after server restart or response loss. No memory lock or automatic POST retry is used. PostgreSQL transactions are bounded (5s acquisition wait, 10s transaction timeout).
The migration must be applied before deploying support for keyed requests. Only the isolated local test database has been migrated here.
## Retention
Responses are replayable for 30 days from first creation, without extending expiry on reads.
After expiry, retain key hash, request hash, endpoint and order link as tombstones indefinitely; do not reuse expired keys or delete these records through a generic TTL purge. Expired requests never create new orders.
purgeExpiredIdempotencyResponses() clears expired JSON response snapshots while retaining tombstones. It is tested on the isolated database and is not automatically scheduled or called on startup. Schedule this maintenance only after explicit operational approval; otherwise snapshots remain physically retained after replay expiry. Raw request bodies are not stored. Direct-order snapshots contain personal data and need the same access/backup controls as orders.
No stock reservation, Stripe idempotency, payment state transitions or shipping activation is included.
## Future Store adaptation (NOT implemented)
1. Complete product refresh/confirmation before creating a new attempt. Generate a cryptographic UUID and persist it with the canonical submission snapshot BEFORE the first POST.
2. Extend the API request helper to send the optional header. Maintain the same key and frozen customer/items/options/code/shipping payload across double clicks, timeout, offline recovery, navigation/reload and retries. Preserve the attempt across tabs with appropriate coordination.
3. On an uncertain network/5xx/503 outcome, offer bounded retry using the exact saved attempt. Do not create a new key or overwrite the snapshot when catalog data changes; a successful replay returns the original order.
4. On 201, persist orderId/redirectUrl and navigate; tolerate local storage/redirect failure without creating another attempt. On 409, block and investigate conflicting local attempt state; never rotate automatically. On 410, recover/verify the old order with support before a new attempt.
5. Generate a fresh key only for an explicit distinct purchase or a settled/rejected attempt whose absence of order is known. Define when a definitive pre-creation 400 allows edited data and a new attempt. The existing same-tab pending guard must be adapted to support replay, not simply removed.
6. Keep the deployed no-key Store compatible during rollout. Optional support provides no duplicate guarantee for its legacy requests.
Checkout/Admin require no changes for this lot. Stripe /pay remains non-idempotent until its separate authorized lot.
## Tests
npm test runs the 28 existing synthetic contracts.
npm run test:integration starts a new PostgreSQL 17 cluster bound to 127.0.0.1 on an ephemeral port, applies baseline migrations, creates a legacy synthetic order, then applies the additive migration. Stripe is simulated; server restart uses separate Node processes.
Windows runner suppresses inherited daemon pipes, stops its own cluster in finally and retains ignored synthetic data directories for inspection. No existing PostgreSQL service or production URL is used. PostgreSQL binaries currently use the discovered Windows installation path; other environments need an approved equivalent runner.
