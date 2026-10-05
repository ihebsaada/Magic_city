# Backend contract tests
Run npm run typecheck, npm run build and npm test.
The runner starts a child with synthetic configuration only, replaces Prisma before importing the app, and replaces the Stripe constructor.
HTTP requests target an ephemeral server bound to 127.0.0.1. No database or real payment is contacted.
These tests validate routing, authorization and response contracts, not PostgreSQL transactions or Stripe concurrency.
POST /api/orders remains unchanged: no consumer was found in the deployed Store, Admin or Checkout sources. External integrations require inventory before restriction.
User is the existing admin-account table; no role/revocation model is added here.
