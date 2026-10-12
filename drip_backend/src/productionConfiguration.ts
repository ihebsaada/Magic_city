import { validateStripeApiVersion } from "./stripeApiVersion";
// Production parsing is pure: never constructs clients or connects to a database.
export function productionConfiguration(env: NodeJS.ProcessEnv) {
  const fail = (code: string): never => {
    throw new Error("PRODUCTION_" + code);
  };
  const required = (name: string) => {
    const v = env[name];
    if (!v || v.trim() !== v) return fail("CONFIG_REQUIRED");
    return v;
  };
  if (env.NODE_ENV !== "production") fail("NODE_ENV_DENIED");
  if (Object.keys(env).some((k) => k.startsWith("STAGING_") && env[k]))
    fail("STAGING_CONFIG_DENIED");
  let db: URL;
  try {
    db = new URL(required("DATABASE_URL"));
  } catch {
    return fail("DATABASE_DENIED");
  }
  if (
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    decodeURIComponent(db.pathname) !== "/magiccitydb_3334" ||
    db.hostname !== required("PRODUCTION_DATABASE_HOST") ||
    /staging/i.test(db.hostname) ||
    db.hash ||
    !["require", "verify-full"].includes(db.searchParams.get("sslmode") || "")
  )
    fail("DATABASE_DENIED");
  if (!/^sk_live_[A-Za-z0-9_]+$/.test(required("STRIPE_SECRET_KEY")))
    fail("STRIPE_DENIED");
  if (!/^whsec_[A-Za-z0-9_]+$/.test(required("STRIPE_WEBHOOK_SECRET")))
    fail("WEBHOOK_DENIED");
  const jwt = required("JWT_SECRET"),
    ticket = required("NAVIGATION_HANDOFF_SECRET");
  if (
    jwt.length < 32 ||
    ticket.length < 32 ||
    new Set([jwt, ticket, env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET])
      .size !== 4
  )
    fail("SECRET_DENIED");
  if (required("STRIPE_CURRENCY") !== "eur") fail("STRIPE_CONFIG_DENIED");
  validateStripeApiVersion(env.STRIPE_API_VERSION);
  const origin = (key: string) => {
    let u: URL;
    try {
      u = new URL(required(key));
    } catch {
      return fail("ORIGIN_DENIED");
    }
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      /staging|localhost|example\.invalid/i.test(u.hostname)
    )
      fail("ORIGIN_DENIED");
    return u.origin;
  };
  const store = origin("PRODUCTION_STORE_ORIGIN"),
    checkout = origin("PRODUCTION_CHECKOUT_ORIGIN"),
    api = origin("PRODUCTION_API_ORIGIN"),
    admin = origin("PRODUCTION_ADMIN_ORIGIN");
  if (
    new Set([store, checkout, api, admin]).size !== 4 ||
    required("PRODUCTION_ADMIN_ORIGIN") !== admin
  )
    fail("ORIGIN_DENIED");
  if (required("CHECKOUT_APP_URL") !== checkout) fail("REDIRECT_DENIED");
  const success =
    checkout +
    "/order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}";
  const cancel = checkout + "/checkout-landing?orderId={ORDER_ID}";
  if (
    required("STRIPE_SUCCESS_URL") !== success ||
    required("STRIPE_CANCEL_URL") !== cancel
  )
    fail("REDIRECT_DENIED");
  if (!["true", "false"].includes(required("NAVIGATION_HANDOFF_ENABLED")))
    fail("NAVIGATION_CONFIG_DENIED");
  return {
    production: true as const,
    staging: false as const,
    origins: [store, checkout, api, admin],
    handoffOrigins: { store, checkout },
    navigationHandoffEnabled: env.NAVIGATION_HANDOFF_ENABLED === "true",
  };
}
// No environment bypass: readiness is verified against the database before app startup.
// Technical compatibility only: does NOT certify provider obligations or recovery operations.
// Historical rows stay unchanged; the SecureOrderPolicy guards remain authoritative.
export async function requireProductionLegacyReadiness(
  client?: import("@prisma/client").PrismaClient,
): Promise<void> {
  try {
    const db =
      client ||
      (require("./prisma").default as import("@prisma/client").PrismaClient);
    const ready = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'");
        const [row] = await tx.$queryRawUnsafe<
          Array<{ ready: boolean }>
        >(`SELECT
    (SELECT count(DISTINCT migration_name)=9 FROM public._prisma_migrations
     WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name IN (
      '20261003120000_add_order_idempotency','20261004120000_add_payment_attempts',
      '20261004160000_add_stock_reservations','20261004190000_add_guest_order_access',
      '20261004210000_product_read_indexes','20261004230000_add_order_handoff',
      '20261005120000_add_navigation_handoff','20261010120000_add_secure_order_policy',
      '20261010150000_add_historical_webhook_receipt'))
    AND NOT EXISTS(SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM public."SecureOrderPolicy" WHERE "policyVersion"<>1)
    AND (SELECT count(*)=12 FROM (VALUES
     ('OrderIdempotency'),('PaymentAttempt'),('PaymentFinalization'),('StripeEvent'),
     ('OrderReservation'),('StockReservationItem'),('GuestOrderAccess'),('GuestOrderRecovery'),
     ('OrderHandoff'),('NavigationHandoff'),('SecureOrderPolicy'),('HistoricalWebhookReceipt')) t(name)
     WHERE to_regclass(format('public.%I',name)) IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM public."HistoricalWebhookReceipt"
     WHERE decision<>'HISTORICAL_QUARANTINED' OR "reviewState" NOT IN ('PENDING','REVIEWED')) AS ready`);
        return row?.ready === true;
      },
      { timeout: 15000 },
    );
    if (!ready) throw Error();
  } catch {
    throw new Error("PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED");
  }
}
