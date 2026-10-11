# Préparation Store / Checkout Netlify staging

5 octobre 2026, Africa/Tunis. Aucun commit, push, déploiement, paiement ou accès DB.
Backend référence 40793c41dc3f916c1179b1605284ecf58ad13392 lu seulement.

## Résultats

| Contrôle | Store | Checkout |
| --- | --- | --- |
| Worktree et branche source attendus | PASS fix/store-product-loading | PASS fix/checkout-guest-access |
| HEAD source | bf60c5fd781655200ff0431a41233841ceb9256a | 6b9c8b963307f6771847d125d05ac4c9e2c3d05e |
| Secrets candidats | PASS : aucune valeur réelle identifiée | PASS : aucune valeur réelle identifiée |
| TypeScript app/config/tests | PASS | PASS |
| Tests locaux simulés | PASS 85 | PASS 51 |
| Build production isolé | PASS | PASS |
| _redirects et variables dans les bundles | PASS | PASS |
| API du parcours sécurisé | PASS par lecture, pas E2E distant | PASS landing/handoff/pay/confirm ; FAIL route Cart héritée |
| Branche staging | staging/store, fichiers conservés par SHA-256 avant/après | NON CRÉÉE : blocage critique |
| Index | Préparé Store + tools/staging seulement | NON PRÉPARÉ : arrêt Git |
| Netlify réel / navigateur / Stripe distant | NON EXÉCUTÉS | NON EXÉCUTÉS |

node tools/staging/prepare-frontends.cjs rejoue uniquement les validations frontend,
avec fetch simulé dans les suites, envDir vide et builds dans .runtime. Les domaines
example.invalid servent aux contrôles de compilation, jamais à un déploiement.
Les sources métiers et les politiques de sécurité n'ont pas été modifiées ici.
136 tests PASS ; aucun backend/test PostgreSQL ni launcher de staging démarré.
L'installation depuis zéro npm ci sur Linux/Netlify reste non exécutée. Dépendances
existantes et lockfiles employés. JSON utile du lockfile Checkout identique à sa
base 6b9c8b9 : seul son suffixe NUL corrompu avait été réparé dans la phase antérieure.

## Blocage Checkout avant publication

src/pages/Cart.tsx est une route active /cart, accessible depuis Navigation.tsx.
Elle appelle POST /api/seamless/checkout : endpoint ABSENT du backend de référence.
Son payload encryptedCart/genericName/total n'est pas le contrat /checkout/intent.
Ce parcours n'a ni Idempotency-Key ni Order-Access-Token et accepte data.url sans
validatePaymentURL. Il affiche USD/centimes. Home peut alimenter ce panier générique.
Ces pages héritées ne font pas partie des tests du module sécurisé : 51 PASS ne
valident donc pas tout le site Checkout. Ne pas remplacer cet endpoint par /pay
ou /checkout/intent avec le même payload pour masquer l'incompatibilité.

Correction à autoriser avant publication : retirer ce parcours de vente générique
ou faire renvoyer Home/Cart/Navigation vers le Store réel, sans effacer checkout_cart
ou les tentatives/grants/sessions. Garder landing et confirmation sécurisées pour
les commandes existantes. Choix UX et tests des liens/routes à valider séparément.
Aucun correctif métier installé. La consigne d'arrêt Git Checkout est appliquée.

## Compatibilité du parcours Store sécurisé

/catalog/products retourne items + pagination et variants exacts ; les clés de
requête comportent les filtres/page/tri. Fiche complète et cartes ont des caches
séparés. La variante exacte détermine prix/stock ; option3 ambiguë est refusée.
/discounts/preview vérifie la remise ; /checkout/intent conserve le body figé,
Idempotency-Key et Order-Access-Token préparé avant création. GET /orders/:id/min
avec le token vérifie total EUR avant le panneau de handoff.
Store inspect/approve et Checkout create/redeem utilisent les routes présentes.
Origines backend EXACTES Store/Checkout indispensables ; un alias Netlify preview
non configuré doit être refusé, pas autorisé par wildcard.
Checkout pay conserve sessionId avant navigation, exige son credential et reprend
le même ordre/session ; confirm vérifie le sessionId enregistré puis relit EUR/PAID.
401/409/410/429/503 ne déclenchent pas une nouvelle commande. Recovery réel absent :
perte complète des credentials reste bloquante ; aucun faux accès sur orderId.

## Configuration des FUTURS sites distincts

| Champ | Store | Checkout |
| --- | --- | --- |
| Branche à publier ultérieurement | staging/store | staging/checkout, non créée |
| Base directory | drip_frontend | seamless_checkout_flow |
| Build command | npm run build | npm run build |
| Publish directory, relatif à base | dist | dist |
| Node proposé, testé localement | 24.19.0 | 24.19.0 |
| SPA public/_redirects existant | /* /index.html 200 | /* /index.html 200 |

Pas de netlify.toml trouvé ; configuration Dashboard future suffisante. Aucun site
existant modifié. Ne jamais choisir main/dripFrontend/dripCheckout/dripBackend.
Les paramètres et réécritures sont conformes à la documentation officielle :
https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/
https://docs.netlify.com/build/configure-builds/overview/

Variables publiques BUILD Store : VITE_API_URL = origine backend staging + /api,
sans slash final ; VITE_CHECKOUT_ORIGIN = origine HTTPS Checkout staging, sans chemin.
Variables publiques BUILD Checkout : VITE_PRIMARY_API_URL = même base API ;
VITE_STORE_ORIGIN = origine HTTPS Store staging, sans chemin ;
VITE_ROUTER_BASENAME=/ (défaut, optionnel mais recommandé explicitement).
VITE_SHOP_URL n'est lue nulle part : ne pas s'en servir pour le retour Store.
NODE_VERSION=24.19.0 est une variable de build Netlify, pas une variable VITE.

Omettre VITE_COMMON_CHECKOUT_ENABLED et VITE_LOCAL_STRIPE_ORIGIN. Les builds
production refusent le simulateur et désactivent l'automatisme DEV local même si
--mode staging est utilisé. Deux sites Netlify distincts utilisent l'appairage
manuel, pas le stockage commun de /checkout/. Ne pas configurer basename=/checkout/
pour un site Checkout indépendant à la racine.

Aucun DATABASE_URL/JWT_SECRET/ADMIN_PASSWORD/sk_test/sk_live/whsec dans VITE_*.
Les exemples .env.staging.example sont sans secrets, à remplacer par les vrais
domaines après création sous autorisation. Les fallbacks actuels pointent vers
localhost pour l'API et vers les domaines publics production pour certains liens :
les variables ci-dessus sont impératives pour éviter un mauvais parcours staging.
Aucun garde de build fail-closed supplémentaire ajouté dans cette mission.

## Limites et contrôles restants

Backend startup exige encore toutes ses variables de staging, dont les origines,
webhook test et destinations Stripe. Il doit être opérationnel avant les clients.
CHECKOUT_APP_URL = origine Checkout sans slash final ; success = /order-confirmation
avec orderId/session_id ; cancel = /checkout-landing avec orderId. Préserver les
requests des sessions existantes ; ne pas changer leurs destinations.
Les ressources marketing Store Shopify/Google et Checkout Unsplash existent encore.
Aucun chargement réseau réalisé par ces validations ; un futur navigateur chargera
ces ressources sans CSP dédiée. Décider de leur isolation avant le staging distant.
Pas de CSP production certifiée, pas de test de navigateur/Netlify/Linux, pas de
notification recovery opérationnelle. Anciennes commandes sans grant ne sont pas
converties automatiquement. Appairage UX et reprise inter-onglets restent à tester.

## Exclusions Git

Store : dist/node_modules/.env réels/logs ignorés ; .env.staging.example autorisé.
tools/staging/.runtime, logs, *RESULTS*.json et COMPATIBILITY*INVENTORY.json ignorés.
Ces JSON sont des sorties générées, pas des entrées lues par les tests ; aucun fichier
local supprimé. Scripts, fixtures, tests et rapports Markdown restent versionnables.
Les trois documents/workspace sous docs/ préexistants restent hors index.
Checkout : .env réels, builds/node_modules/logs/.tests et tests/*RESULTS*.json ignorés.
Son exemple et rapport sont préparés localement mais aucun fichier n'est staged.

Fichiers nouveaux/modifiés cette mission : Store .gitignore et .env.staging.example ;
tools/staging/.gitignore, prepare-frontends.cjs, présent rapport ; Checkout .gitignore,
.env.staging.example et tests/NETLIFY_STAGING_PREPARATION.md. Tout le travail métier
antérieur demeure intact. Aucun fichier backend modifié.

Messages de commits proposés, non exécutés :
- feat(store): integrate paginated catalogue and secure checkout attempts
- feat(checkout): secure guest handoff and payment reconciliation

READY_FOR_STORE_COMMIT = YES
READY_FOR_CHECKOUT_COMMIT = NO
READY_FOR_NETLIFY = NO

## Index final vérifié

Store : 65 fichiers staged, tous sous drip_frontend/ ou tools/staging/.
git diff --cached --check : PASS. Stat : 65 fichiers, 5128 insertions, 898 suppressions
avant cet ajout documentaire final. Checkout : zéro fichier staged, branche source
fix/checkout-guest-access conservée. Les dépendances déclarées installées correspondent
au lockfile : Store 68/68, Checkout 66/66. Aucun artefact généré staged.
