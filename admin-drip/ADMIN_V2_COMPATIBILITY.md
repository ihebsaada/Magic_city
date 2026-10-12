# Admin Hub V2 compatibility and controlled release

Implementation baseline: `origin/adminHub` at `d0c2248667e8a7b136e7f128551644f0a931357e`. Its `admin-drip` tree equals `origin/main` at `dd9d88fe8577fb7c31a3bbf3a0e7945900643887`, despite a 43-commit repository-level gap. No merge or rebase of main was needed. All changes on this branch are confined to `admin-drip`.

The intended production branch remains **adminHub**. Netlify's actual configuration and automatic deployment setting could not be inspected: no connected browser/account session is available. These must be verified before any push or release. Do not change the production branch to main.

## Contracts

All paths below are relative to `/api`. Every route except login requires an unexpired Admin Bearer JWT. Response arrays remain arrays. Dates are ISO timestamps; decimals in product/order DTOs are strings or null. Nullable catalog data is displayed without inventing values.

| # | Method and path | Request | Success response | Frontend behavior |
| --- | --- | --- | --- | --- |
| 1 | POST `/admin/auth/login` | `{email,password}` | 200 `{token,user:{id,email}}` | No stale Bearer; validate session, persist, safe internal redirect |
| 2 | GET `/admin/products?search=…` | Encoded optional search | 200 `Product[]` | Debounced search; client collection filter; EUR price range |
| 3 | GET `/admin/products/:id` | Positive integer ID | 200 `Product` with flattened collections | Detail with nullable fields and physical/reserved/available stock |
| 4 | POST `/admin/products` | Title, handle, metadata, URL images, collection IDs, positive EUR price, optional SKU/stock/options | 201 product with variants/images and raw collection links | Validate; empty new stock becomes zero; no duplicate success |
| 5 | PATCH `/admin/products/:id` | Changed metadata/images/options; additive `variantUpdate:{variantId,…changedFields}` | 200 product with raw collection links | Atomic metadata + selected variant + images; omit unchanged fields |
| 6 | DELETE `/admin/products/:id` | No body | 204 | Confirm; explain protected history; recommend archive |
| 7 | PATCH `/admin/products/:id/default-variant` | `{variantId?,price?,compareAtPrice?,inventoryQuantity?,sku?}` | 200 variant | Existing service remains typed; form now uses atomic PATCH #5 with explicit ID |
| 8 | GET `/admin/collections` | None | 200 `Collection[]`, including `productsCount` | Loading/error/empty state |
| 9 | GET `/admin/collections/:handle` | Encoded handle | 200 `{collection,products}` | Read collection with EUR prices |
| 10 | POST `/admin/collections` | `{title,handle,description?}` | 201 collection without `productsCount` | Validate, then refresh authoritative list |
| 11 | PATCH `/admin/collections/:id` | Changed title/handle/description; null clears description | 200 collection without `productsCount` | Refresh; report conflicts |
| 12 | DELETE `/admin/collections/:id` | None | 204 | Confirm; backend removes associations and collection in one transaction |
| 13 | GET `/admin/discounts` | None | 200 `Discount[]`, numeric value, nullable limit/expiry, `reservedUses` | Show consumed and reserved uses; local expiry timestamp |
| 14 | POST `/admin/discounts` | `{code,type,value,usageLimit?,expiresAt?,active?}` | 201 `{id}` | Positive amount, percentage <=100, integer limit, ISO expiry |
| 15 | PATCH `/admin/discounts/:id` | Changed type/value/limit/expiry/active; code immutable | 200 `{ok:true}` | Unchanged expiration omitted, preserving exact timestamp |
| 16 | DELETE `/admin/discounts/:id` | None | 200 `{ok:true}` | Confirm; explain history protection; recommend deactivate |
| 17 | GET `/admin/orders` | None | 200 order array with existing fields and additive capabilities | Modern and historical orders visible |
| 18 | GET `/admin/orders/:id` | Order ID | 200 detail, nullable shipping/payment refs, `canEdit`, `readOnlyReason`, `allowedStatuses` | Missing capability fails closed; historical order read-only |
| 19 | PATCH `/admin/orders/:id` | Changed permitted uppercase `status` only from UI | 200 `{ok:true,id}` | Payment read-only; reload authoritative detail and list |
| 20 (previously unused) | PUT `/admin/products/:id/collections` | `{collectionIds:number[]}` | 200 `{ok:true}` | Explicit replacement; preserve all selected existing IDs; atomic backend operation |

Product GET responses flatten collections; product mutation responses retain the existing raw link shape and have separate types. Collection mutation responses omit counts and have separate types. No Store or Checkout response contract was replaced.

## Errors and data safety

- 400: invalid input, stock, price, URL, ID, discount or date. 401: invalid/expired/missing session; protected calls clear the session. Login 401 does not clear a different session.
- 403: origin or authorization refusal. 404: missing record/variant. 409: duplicate handle/SKU/code, protected history, stock below reservations, limit below used+reserved, forbidden order transition, historical read-only policy.
- 422: nonexistent selected collection. 429: request throttling. 500/503: server/service failure. Unknown codes use status-specific messages, without exposing raw server bodies.
- Non-JSON responses and 204 are handled. Network/CORS failures never trigger automatic write retries. A timed-out write requires an authoritative reload before resubmission.
- Product/selected variant/images save atomically. The explicitly required association PUT is a separate transaction. If it fails after the product PATCH, the UI reports partial completion and does not display full success.
- Unchanged images are omitted; unchanged image arrays preserve IDs on backend. Emptying an existing image list requires confirmation.
- Stock null is unavailable, not unlimited. Reserved counters are never written by the Admin. Existing variants are never implicitly created/deleted by edit operations.
- The UI never submits `paymentStatus`; no manual unpaid-to-paid action is offered. Historical guards and payment/reservation business rules remain authoritative on the backend.
- Lists retain existing complete-array contracts. No pagination was imposed without a verified production volume requirement; measure authenticated list performance before large-catalog rollout. Dashboard recent items are sorted by creation time then ID.

## Validation commands

From `admin-drip` with Node 24.19.0 and the lockfile:

```powershell
npm ci --include=dev
npm run typecheck
npm run lint
npm test
npm run test:browser
$env:VITE_BASE_API_URL='https://magic-city-n6rr.onrender.com/api'
npm run build
```

Browser tests use a local Vite server, synthetic fixtures, mocked API routes, and deny every non-loopback browser request. Default browser channel is installed Edge; set `ADMIN_TEST_BROWSER=chromium` when using a separately installed Playwright Chromium. Tests never write to production APIs.

## Human-controlled release

1. Verify Netlify project `magicadmindrip`, connected repository, production branch **adminHub**, base `admin-drip`, build `npm run build`, publish `dist`, deployed commit and automatic-deploy state. These are expected settings, not remotely confirmed values.
2. Disable automatic builds/deployments for the coordinated release, including environment-change deploy triggers. Do not push while triggers are enabled or unknown.
3. Deploy the matching backend first following its release document. Add only `PRODUCTION_ADMIN_ORIGIN=https://magicadmindrip.netlify.app`; preserve existing production configuration and secrets. No migrations.
4. Verify Admin preflights and readable 401 responses, and unknown/handoff origins still refused.
5. After human approval, fast-forward push only the reviewed `adminHub` commit. Configure Netlify `VITE_BASE_API_URL=https://magic-city-n6rr.onrender.com/api` in the production build context and manually publish that exact commit. No secret belongs in a VITE variable.
6. Verify login and authenticated read-only views using the operator's existing account. Do not create/edit/delete products, stock, orders or discounts as production smoke tests.
7. For rollback, republish the previous Netlify artifact; if backend rollback is required, coordinate both applications, as the new Admin requires the additive capabilities/atomic variant contract. Never restore or rewrite production data. Never force-push a rollback.

Build validation rejects missing, malformed or non-HTTPS API URLs. Updating a Netlify variable requires a controlled rebuild. Production branch must remain adminHub.
