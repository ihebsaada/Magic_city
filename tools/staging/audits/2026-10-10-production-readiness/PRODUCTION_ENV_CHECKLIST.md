# Magic City Drip - production readiness audit, 2026-10-10

All external configuration: REQUIRES MANUAL CHECK unless labelled BLOCKED. No remote action performed.

## A. Render Backend Production

Current runtime accepts production without the strict staging guards. Required below means operationally necessary; not every variable is startup-enforced. This is a checklist, not proof that values are present.

| Variable | Purpose | Requirement | Format | Safe example | Different from staging | Secret-free verification |
|---|---|---|---|---|---|---|
|DATABASE_URL|Database access|Required|postgresql URI; exact magiccitydb_3334 and verified production host|postgresql://USER:REDACTED@VERIFIED_HOST/magiccitydb_3334?sslmode=verify-full|Yes; distinct DB/user|Parse locally; output only pass/fail; verify current_database/server identity read-only|
|JWT_SECRET|Admin JWT signing|Required operationally|New high-entropy >=32 characters|No value shown|Yes|Check length/distinctness locally; never log|
|JWT_EXPIRES_IN|Admin JWT lifetime|Optional default 7d|jsonwebtoken duration|1h|Policy choice|Check sanitized duration in dashboard|
|STRIPE_SECRET_KEY|Hosted Checkout server calls|Required|Dedicated sk_live key for correct production account|sk_live_REDACTED|Yes|Local prefix check plus LIVE dashboard/account verification|
|STRIPE_WEBHOOK_SECRET|Webhook signature|Required|LIVE destination whsec secret|whsec_REDACTED|Yes|Verify source destination/mode; signature delivery check|
|STRIPE_SUCCESS_URL|New session success destination|Required for payments|HTTPS verified Checkout /order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}|https://checkout.example.invalid/order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}|Yes|Parse origin/path/templates locally; inspect LIVE request snapshot|
|STRIPE_CANCEL_URL|New session cancellation destination|Required for payments|HTTPS verified Checkout /checkout-landing?orderId={ORDER_ID}|https://checkout.example.invalid/checkout-landing?orderId={ORDER_ID}|Yes|Parse allowlisted origin/path; preserve old snapshots|
|STRIPE_CURRENCY|Currency of new orders|Operationally required; code defaults eur|eur|eur|No|Compare DB order and Stripe EUR amounts|
|CHECKOUT_APP_URL|Intent redirect URL|Required operationally; unsafe local default exists|Verified HTTPS Checkout origin without trailing slash|https://checkout.example.invalid|Yes|Inspect generated redirect origin without token|
|NAVIGATION_HANDOFF_SECRET|Ticket AES-GCM key derivation|Required for desired handoff, currently production endpoint BLOCKED|Dedicated random >=32 characters|No value shown|Yes; stable while issued tickets remain|Length/distinctness only, never VITE|
|DEPLOYMENT_ENV|Server mode|Required operationally; code permits omission|production|production|Yes|Check exact label; not staging as workaround|
|NODE_ENV|Node production runtime|Required operationally|production|production|No; staging also production runtime|Dashboard label|
|NODE_VERSION|Runtime pin|Build platform setting|24.19.0 tested locally|24.19.0|No|Build/runtime node --version|
|PORT|Listen port|Optional code default4000; platform supplied|Integer1..65535|Render supplied|Platform-managed|Health/bind check|
|STRIPE_API_VERSION|Stripe SDK override|Optional outside staging; keep unset unless explicitly reviewed|Pinned SDK supported API version|UNSET|Keep unset|Check key absent; staging rejects nonempty override|

DIRECT_URL is NOT consumed by schema/code; do not invent it. ADMIN_EMAIL/ADMIN_PASSWORD are seed inputs only, not authentication overrides for a restored user; no seed authorized. STAGING_DATABASE_HOST/STAGING_*_ORIGIN are staging-only and do not configure production CORS. There is currently no production env switch for mandatory guest access, recovery delivery, shipping activation or NavigationHandoff activation: code work is BLOCKED, not solved by additional variable names.

## B. Netlify Store Production

| Variable | Purpose / requirement | Expected public value / example | Difference / verification |
|---|---|---|---|
| VITE_API_URL | Required operationally; API base | Verified production API + /api; https://api.example.invalid/api | Different staging; inspect built module and Network |
| VITE_CHECKOUT_ORIGIN | Required operationally; trusted destination | Verified HTTPS Checkout origin; https://checkout.example.invalid | Different staging; fixed-origin parse |
| VITE_NAVIGATION_HANDOFF_ENABLED | Required true for desired flow, currently MODE-gated | true after production implementation approval | Current production MODE disables it; source/build proof needed |
| VITE_AUTOMATIC_HANDOFF | Old popup alternative; keep disabled | false | Same as staging; inspect bundle |

## C. Netlify Checkout Production

| Variable | Purpose / requirement | Expected public value / example | Difference / verification |
|---|---|---|---|
| VITE_PRIMARY_API_URL | Required; authoritative Checkout API variable | Verified production API + /api | Different staging; inspect built code |
| VITE_STORE_ORIGIN | Required; trusted continue-shopping destination | https://store.example.invalid; actual verified primary Store | Different staging; origin-only no credentials/query/fragment/path |
| VITE_ROUTER_BASENAME | Optional default /; explicitly / for separate site | / | Same staging; routes/reload test |
| VITE_NAVIGATION_HANDOFF_ENABLED | Desired navigation flow; currently MODE-gated | true only after production gate fixed | Production MODE currently disabled |
| VITE_AUTOMATIC_HANDOFF | Old popup mode; disabled | false | Same staging |

VITE_API_URL is not the Checkout API variable. Omit VITE_COMMON_CHECKOUT_ENABLED and VITE_LOCAL_STRIPE_ORIGIN in public builds. VITE_SHOP_URL is not read. No Stripe publishable key required by hosted Checkout redirect. Never expose any database/JWT/Stripe/ticket secret as VITE_*.

Known source defaults reference magiccitydrip.shop and dripcheckout.netlify.app; actual production domains and API must be verified in dashboards. Never treat example.invalid as deployable configuration. Do NOT ship a staging-mode build to production to bypass the MODE guard. Production CORS and exact handoff origin policy need separately authorized code/config design.
