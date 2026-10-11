> Mise ? jour : FULL_OFFLINE_E2E_VALIDATION.md remplace le contrat API_VERSION ci-dessous. Absente, vide ou exactement 2025-12-15.clover sont accept?es ; toute autre valeur est refus?e. Les 18 migrations ont maintenant ?t? test?es uniquement sur de nouveaux clusters Docker synth?tiques. Aucun environnement distant modifi?.

# Contrat Stripe / environnements — 10 octobre 2026

Audit des sources locales et du SDK installé, sans lecture de credentials réels ni connexion distante. Cette passe suit STAGING_BLOCKERS_RESOLUTION ; aucun commit, push, déploiement ou migration exécuté. Les modifications préexistantes restent présentes. Aucun nouveau nom de variable Stripe obligatoire.

## Verdict

**Compatibilité locale PASS pour le contrat actuel**, après deux corrections de validation et un ajout de placeholder documentaire. Configuration effectivement installée sur Render/Stripe : UNKNOWN. Production startup demeure refusé par PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED ; ne pas utiliser staging pour le contourner.

Sources : runtimeConfiguration.ts, productionConfiguration.ts, stagingServer.ts/server.ts, stripeClient.ts, paymentService.ts, orderCreation.ts, stripeWebhookController.ts, historicalWebhookReceipt.ts, app.ts, package-lock/package et .env.staging.example ; helpers Checkout et harness tools/staging/backend.cjs.

| Variable | Staging | Production stricte |
| --- | --- | --- |
| DEPLOYMENT_ENV | staging, imposé par start:staging ; contradiction refusée | production explicite |
| NODE_ENV | production recommandé ; staging parser ne l'impose pas lui-même | production obligatoire |
| STRIPE_SECRET_KEY | obligatoire, regex sk_test_ + caractères alphanumériques/underscore | obligatoire, sk_live_ même alphabet |
| STRIPE_WEBHOOK_SECRET | obligatoire, whsec_ même alphabet | obligatoire, whsec_ même alphabet |
| STRIPE_API_VERSION | override non vide refusé ; laisser unset | idem |
| STRIPE_CURRENCY | facultatif, défaut eur ; valeur fournie non vide doit désormais être EUR (casse acceptée) | obligatoire, exactement eur |
| STRIPE_SUCCESS_URL | obligatoire, origin Checkout configurée, sans credentials/fragment/token/secret en query | template exact Checkout /order-confirmation?orderId={ORDER_ID}&session_id={CHECKOUT_SESSION_ID} |
| STRIPE_CANCEL_URL | mêmes contrôles staging | template exact Checkout /checkout-landing?orderId={ORDER_ID} |
| CHECKOUT_APP_URL | obligatoire, origin Checkout correspondante ; path autorisé pour le harness historique préfixé | origine Checkout exacte, pas de trailing slash |
| NAVIGATION_HANDOFF_SECRET | secret EXISTANT >=32, vérifié lors handoff/quarantaine ; pas obligatoire dans le parser startup staging actuel | >=32 et distinct JWT/Stripe au startup |
| JWT_SECRET | obligatoire >=32 | >=32 et distinct handoff/Stripe |
| DATABASE_URL / host | base magiccity_db_staging et host STAGING_DATABASE_HOST exacts | magiccitydb_3334, PRODUCTION_DATABASE_HOST vérifié, TLS require/verify-full ; aucun accès réalisé |
| Origins | STAGING_STORE_ORIGIN, STAGING_CHECKOUT_ORIGIN, STAGING_API_ORIGIN HTTPS, sans credentials/path/query/hash ; domaines production connus refusés | PRODUCTION_* origins HTTPS distinctes, sans staging/local/example.invalid |
| NAVIGATION_HANDOFF_ENABLED | entrée staging garde son comportement existant | true/false explicite contrôle création, pas redemption |

JWT_EXPIRES_IN utilise le contrat existant ; NODE_VERSION=24.19.0 reste le pin de plateforme recommandé, pas une validation de version dans runtimeConfiguration. PORT entier 1..65535, fourni par plateforme. Aucune clé privée Stripe ne doit être VITE_*.

Les regex test/live/whsec ne prouvent ni compte, ni droits, ni destination : cela reste une vérification manuelle future. Les restricted keys rk_* ne sont PAS acceptées actuellement ; aucun élargissement silencieux effectué. Valeur vide STRIPE_API_VERSION est traitée comme absence par le code ; consigne opérationnelle : variable réellement unset.

## API et webhook

SDK installé/lock : stripe 20.1.0 ; version par défaut lue dans son code : **2025-12-15.clover**. Sans override, stripeClient laisse le SDK utiliser ce défaut. Aucun appel à Stripe pour vérifier son dashboard/version réelle. `timeout=15000`, `maxNetworkRetries=0` restent inchangés ; la reprise métier conserve PaymentAttempt et sa clé stable.

Route publique : **POST /api/stripe/webhook**, express.raw(application/json) avant express.json, constructEvent sur les octets signés. Événements explicites : checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed. Staging refuse livemode autre que false ; production refuse autre que true. Pas de bypass de signature ou timestamp dans le code applicatif.

La requête Checkout Stripe utilise UNE ligne agrégée depuis Order.total/currency, metadata order_id/attempt_id ; pas de prix navigateur. EUR 14,90 →1490 cents. Le serveur remplace {ORDER_ID} ; le placeholder {CHECKOUT_SESSION_ID} reste destiné à Stripe. Les accolades sont des caractères de chaîne, pas une expansion automatique dans ce code. Leur transport par une configuration distante n'a pas été vérifié ici.

Staging refuse customer/customer_email/receipt_email avant appel fournisseur ; production conserve son customer_email existant. Les sessions relues sont contrôlées livemode ; désormais les réponses de création le sont aussi, AVANT que le service puisse les persister/répondre comme utilisables. Mauvais mode ou mode absent →refus. Ce contrôle ne peut pas annuler une session que le fournisseur aurait déjà créée ; il empêche son acceptation applicative et exige revue.

Historique : décision persistée dans HistoricalWebhookReceipt avant ACK technique, sans PAID/OrderItem ni finalisation. Erreur de persistance/classification maintient l'échec/retry. Politique et revue humaine : HISTORICAL_WEBHOOK_REVIEW_RUNBOOK.md, inchangée par cette passe.

## Corrections locales exactes

- Backend `src/services/stripeClient.ts` : contrôle livemode de create, staging ET production ; garde destinataires staging synchrone conservée.
- Backend `src/runtimeConfiguration.ts` : refuse STRIPE_CURRENCY staging non-EUR si fournie, conserve absence/chaîne vide → défaut eur. Corrige un contrat auparavant accepté au startup mais incompatible avec le Checkout Store EUR.
- Backend `tests/runtime-staging.test.cjs` : matrice devise optional/default/casse/invalidité.
- Backend `tests/runtime-production.test.cjs` : faux SDK complété avec create ; aucune validation runtime affaiblie pour satisfaire le mock.
- Backend `.env.staging.example` : placeholder NAVIGATION_HANDOFF_SECRET existant ajouté ; il manquait au template malgré son besoin opérationnel. Aucun secret réel ajouté.

Aucune modification du prix, shipping, montant historique, handoff, guest/cart clearing ou logique de finalisation. Aucune nouvelle migration. Les 18 migrations antérieures restent présentes mais NON exécutées dans cette passe.

## Frontends / séparation

Store : VITE_API_URL, VITE_CHECKOUT_ORIGIN, VITE_NAVIGATION_HANDOFF_ENABLED. Checkout : **VITE_PRIMARY_API_URL**, VITE_STORE_ORIGIN, VITE_ROUTER_BASENAME=/, flag handoff. Aucun STRIPE_SECRET_KEY/WEBHOOK_SECRET/NAVIGATION_HANDOFF_SECRET côté frontend. Stripe checkout.stripe.com exact accepte son fragment ; arbitrary origins/credentials refusés. Simulateur HTTP loopback seulement dans les conditions DEV existantes, jamais élargi en bundle public. Le nouveau simulateur hors ligne retourne une URL officielle fictive mais NE l'ouvre PAS.

Le harness historique start.cjs/backend.cjs applique des migrations et utilise un fournisseur synthétique persistant/local. Il n'a pas été lancé ici. Le nouveau simulateur pur complète les essais sans DB et sans modifier les flags applicatifs. Les modes VM production/staging ne démarrent pas le serveur production et ne retirent pas son stop.

## Conditions restantes

Inventaires/checksums et backup/restore staging puis production, obligations historiques Stripe/SumUp, suivi des PENDING/CRITICAL, configuration réelle/origines/compte LIVE, Linux/binaire rollback et E2E navigateur/fournisseur restent non vérifiés. La configuration locale compatible ne vaut pas autorisation de lancement.

```text
ADDITIONAL_MANDATORY_STRIPE_ENV_VARIABLES=NONE
REAL_CREDENTIALS_CHANGED=NO
ENV_COMPATIBILITY=PASS_LOCAL_CONTRACT
REMOTE_ENV_COMPATIBILITY=UNKNOWN
PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED=ACTIVE
PRODUCTION_DEPLOYMENT_GO=NO
```

Le template drip_backend/.env.staging.example est actuellement ignore et non suivi (check-ignore confirme). Il contient seulement des placeholders ; aucun ajout force a l index. Les 37 candidats backend ordinaires ne l incluent pas. Une inclusion future exige revue explicite.
