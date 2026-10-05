# Restauration historique Magic City - 5 octobre 2026

Rapport local. Aucun commit, push, merge, deploiement, paiement reel ou appel aux
services publics. Aucun changement backend ni migration nouvelle. Les clusters
synthetiques, tentatives et stockages existants sont conserves. Index Git vides.

La mission n'est PAS integralement achevee : le paiement autonome historique du
Mirror Shop ne peut pas etre retabli avec les garanties actuelles dans le
perimetre backend limite au handoff. L'interface et le panier sont restaures,
sans transformer les mockups en catalogue reel. Aucune parite visuelle absolue
ni validation navigateur n'est revendiquee.

## Historique et diagnostic

Store historique : bf60c5fd781655200ff0431a41233841ceb9256a. Loader ajoute par
2fef884 ; restauration de LoadingScreen et overlay historique, navigation 400 ms,
avec suivi des lectures/mutations et fin apres echec. Store actuel conserve
8b3bb0de062a70e6c71b0c09534e727b3af9abef, branche staging/store.

Checkout fonctionnel source : 22dc26a409c868c29df12c38224286aa47d16bcd, avec
fonction Supabase checkout. Reference visuelle italienne :
6b9c8b963307f6771847d125d05ac4c9e2c3d05e. 5844190 supprime Supabase et introduit
seamless/checkout ; cd24c7c traduit l'interface ; 6b9c8b9 modifie les images ;
2d3146d retire Mirror Shop lors de la securisation. Le fonctionnement historique
deploye ne peut pas etre prouve ici. Checkout actuel conserve
2d3146d60ecf9728dd1828def7292b837236bd95, branche staging/checkout.

Le backend staging/backend reste exactement a
40793c41dc3f916c1179b1605284ecf58ad13392, worktree propre.

L'ancien paiement generique Supabase utilisait des prix navigateur et USD,
sans reservations de variantes. Il ne peut pas etre copie ni remplace par un
mapping commercial invente. Son portage securise necessite une autorisation
backend metier distincte : offres, prix/devise serveur et politique de stock.

## Parcours et changements

Store conserve corps fige, cle, token et reprise. Le clic ouvre une fenetre
neuve avant les awaits. Apres commande connue et total verifie, le Store navigue
cette fenetre vers Checkout avec seulement orderId public. postMessage ne porte
aucun credential : origine EXACTE, WindowProxy, commande et nonces sont controles.
Checkout persiste son propre grant avant preparation. Store inspecte/autorise
avec son token scoped. Checkout redime et lit la commande avec son propre token,
puis accuse reception. Backend, CORS, paiement et webhook restent inchanges.

Le canal est active seulement par VITE_AUTOMATIC_HANDOFF=true configure dans les
deux applications. Le nonce de canal est conserve pour reload sans rotation du
grant ; il expire sans prolongation. Popup bloque, fermeture, perte d'opener,
timeout et stockage indisponible donnent un blocage explicite. Aucune commande
ou session de secours n'est creee. Le flag doit etre coordonne : la nouvelle
presentation Landing ne fournit pas le panneau de pairing manuel historique.

Mirror Shop retrouve cinq mockups, prix USD visibles historiques, cards,
animations, navigation, compteur et panier propre (quantites/suppression).
Son bouton de paiement refuse explicitement et conserve le panier. Les commandes
Store utilisent toujours le parcours scoped, EUR et reconciliation existante.
Landing et confirmation retrouvent leurs enveloppes historiques ; aucun succes
n'est deduit de l'URL. Le panier generique Mirror n'est pas vide par le paiement
d'une commande Store.

## Preuves et limites

Les suites applicatives incluent Backend 37 contrats non-DB + 190 PostgreSQL,
Store 89, Checkout 64, transfert/paiement commun 20 : total 400 assertions/tests
de runners, a distinguer des 29 scenarios HTTP groupes et six controles routage.
Les sources reelles du canal sont compilees dans des VM avec fenetres/stockage
simules ; le scenario HTTP utilise les vrais endpoints et PostgreSQL isole.
Ils ne constituent pas un navigateur ni un paiement Stripe reel.

Dernier validate.cjs : code 0, toutes les suites et les quatre groupes de lint
PASS. Dernier start.cjs --verify : code 0, run-1791197916613 arrete normalement
et conserve, 29 scenarios et six controles PASS. Les quatre ports du harness
sont libres apres validation. Aucun processus utilisateur ferme de force.

TypeScript des trois projets, builds, Prisma generate/validate et lint des
fichiers concernes sont verifies. Lint global Store non revendique : trois
erreurs preexistantes restent hors scope. Les builds publics locaux isolent
envDir et incorporent les URL staging sans appeler les services. Absence de
localhost:4000/api et seamless/checkout dans ces bundles verifiee. Le fallback
localhost reste dans la source API historique, pas dans les bundles configures.
Quatre bundles de politique production refusent le simulateur et le transfert
commun DEV ; cela ne desactive pas le nouveau canal explicitement configure.

Intermediaires corriges : header token perdu par spread d'un objet Headers dans
le harness HTTP ; assertion du message recupero ; espaces finaux historiques ;
cwd Tailwind du nouveau controle de bundle. Une premiere initialisation PG a
echoue (spawn pg_ctl) ; le cluster a ete conserve et les passages suivants passent.
Ces erreurs ne sont pas masquees par un PASS navigateur.

Scan des candidats modifies/non suivis : aucune correspondance de cle Stripe
reelle, URL PG credentialee ou cle privee. Les exemples sont des configurations
publiques/placeholders. Aucun secret emis dans les messages du canal ; les tests
verifient les URLs et le transcript sans token. Proxy/APM distant non audite.

## Statuts demandes

```text
HISTORICAL_BASELINE_STORE=bf60c5fd781655200ff0431a41233841ceb9256a
HISTORICAL_BASELINE_CHECKOUT=22dc26a fonctionnel source; 6b9c8b9 visuel italien
STORE_UI_MATCH=PARTIAL
CHECKOUT_UI_MATCH=PARTIAL
MIRROR_SHOP_RESTORED=PARTIAL; interface/panier YES, paiement autonome NO
MACRO_UI_PARITY=PARTIAL
MICRO_UX_PARITY=NON VALIDEE EN NAVIGATEUR
LOADING_STATES_PARITY=SOURCE RESTOREE ET TESTEE; navigateur NON VALIDE
ERROR_STATES_PARITY=PARTIAL; blocages securises explicites conserves
RESPONSIVE_PARITY=NON VALIDEE
INTERACTION_PARITY=PARTIAL
HISTORICAL_LOADING_SPINNER_FOUND=YES
HISTORICAL_LOADING_SPINNER_RESTORED=YES
LOADING_BEHAVIOR_MATCH=PARTIAL; navigation/fin/echec testes
MICRO_UX_REGRESSIONS_FOUND=overlay, selects, collections, cards, Mirror Shop, landing/confirmation
MICRO_UX_REGRESSIONS_FIXED=restaurations source ci-dessus; verification visuelle restante
REMAINING_UI_UX_DIFFERENCES=paiement Mirror bloque, popup, pagination, nouveautes et erreurs securisees
OLD_FLOW=Store navigation Checkout; Mirror autonome Supabase generique USD
BROKEN_STAGING_FLOW=Mirror supprime et endpoint seamless absent; pairing manuel
FINAL_FLOW=Store popup/canal scoped automatique; Mirror interface/panier sans paiement autonome
MANUAL_PAIRING_REMOVED=YES nouveau happy path configure; backend pont conserve
AUTOMATIC_HANDOFF=PASS tests VM et HTTP; navigateur NON VALIDE
ORDER_ID_ONLY_ACCESS_DENIED=YES clients adaptes; NO garantie serveur globale en mode compatible
IDEMPOTENCY_PRESERVED=PASS
PAYMENT_ATTEMPTS_PRESERVED=PASS
STOCK_RESERVATIONS_PRESERVED=PASS
DISCOUNT_RESERVATIONS_PRESERVED=PASS
GUEST_ACCESS_SECURITY_PRESERVED=PASS garanties existantes; compatible residuel inchange
STRIPE_RECONCILIATION_PRESERVED=PASS simulation
WEBHOOK_SECURITY_PRESERVED=PASS simulation
STORE_TESTS=89 PASS
CHECKOUT_TESTS=64 PASS
BACKEND_TESTS=227 PASS (37+190)
CROSS_APP_TESTS=20 PASS; 29 scenarios HTTP et 6 controles routage PASS separes
TOTAL_TESTS=400; plus 29 scenarios groupes et 6 controles routage
STORE_TYPESCRIPT=PASS
CHECKOUT_TYPESCRIPT=PASS
BACKEND_TYPESCRIPT=PASS
STORE_BUILD=PASS
CHECKOUT_BUILD=PASS
BACKEND_BUILD=PASS
STORE_LINT=PASS fichiers concernes; global non execute
CHECKOUT_LINT=PASS fichiers concernes
BACKEND_LINT=PASS fichiers integration; aucun changement source
PRISMA_GENERATE=PASS
PRISMA_VALIDATE=PASS
STORE_DIFF_CHECK=PASS
CHECKOUT_DIFF_CHECK=PASS
BACKEND_DIFF_CHECK=PASS
LOCALHOST_RUNTIME_REFERENCE=ABSENTE des bundles publics configures; fallback source conserve
SECRETS_FOUND=NONE dans les candidats inspectes
FILES_CHANGED_BACKEND=NONE
KNOWN_LIMITATIONS=paiement Mirror hors scope, popup/COOP, XSS, stockage ferme, recovery non configure, serveur compatible
BROWSER_TESTS_STILL_REQUIRED=YES desktop/mobile, UI, reload/fermeture, popup/COOP, retour paiement, fuite outils tiers
READY_FOR_CONTROLLED_COMMIT=NO
READY_FOR_STAGING_DEPLOY=NO
```

## Fichiers modifies/ajoutes dans cette mission

Store, sous drip_frontend/ :

- .env.staging.example
- scripts/run-tests.mjs
- src/components/CatalogueBrowser.tsx
- src/components/CollectionCard.tsx
- src/components/layout/Layout.tsx
- src/hooks/useHistoricalLoading.ts (nouveau)
- src/lib/automaticHandoff.ts (nouveau)
- src/pages/Cart.tsx
- src/pages/CollectionDetail.tsx
- tests/store-backend-integration.test.tsx
- tests/automatic-handoff.test.ts (nouveau)
- tests/historical-loading.test.tsx (nouveau)

Checkout, sous seamless_checkout_flow/ :

- .env.staging.example
- scripts/run-tests.mjs
- src/components/Navigation.tsx
- src/lib/secureCheckout.ts
- src/lib/automaticHandoff.ts (nouveau)
- src/lib/cart.ts (restaure)
- src/pages/Home.tsx
- src/pages/Cart.tsx
- src/pages/CheckoutLanding.tsx
- src/pages/OrderConfirmation.tsx
- tests/store-navigation.test.ts
- tests/automatic-handoff.test.ts (nouveau)
- tests/mirror-parity.test.tsx (nouveau)

Outillage Store, sous tools/staging/ :

- start.cjs, scenario.cjs, validate.cjs, common-access-tests.cjs, README.md
- automatic-handoff-http.cjs (nouveau)
- public-bundle-validation.mjs (nouveau)
- HISTORICAL_PARITY_AUDIT.md (nouveau)
- FINAL_HISTORICAL_PARITY_VALIDATION.md (present rapport)

Les resultats/builds/logs sous .runtime et les JSON de resultats ignores sont
locaux, conserves et hors index. Le dossier docs/ preexistant n'est pas modifie.

## Verification manuelle restante

Depuis Magic_city_git :

```powershell
node tools/staging/start.cjs --automatic-handoff
```

Suivre la section restauration du README : Store 5173, Checkout 5174, backend
4100, simulateur 4101. Aucun appel Stripe reel. Ctrl+C arrete le harness et
conserve le cluster. Comparer palettes, dimensions, responsive, transitions,
spinner, formulaires, panier, Mirror mockups et parcours Store complet.
Tester popup bloque, COOP, reload pendant preparation/accord, fermeture de chaque
fenetre, reponses perdues, autres commandes/sessions et stockage inaccessible.
Ne jamais injecter un token ni effacer les tentatives pour forcer le succes.

STOP : aucun commit/push/deploiement. Le portage commercial securise du paiement
Mirror demande un perimetre backend distinct, sans choix arbitraire sur son UI.
