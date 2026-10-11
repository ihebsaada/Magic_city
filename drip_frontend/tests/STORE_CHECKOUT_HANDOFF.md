# Store → Checkout — pont d'appairage authentifié

Validation locale du 4 octobre 2026 (Africa/Tunis).
Implémentation autorisée, sans commit, push, merge, déploiement, paiement réel,
notification réelle, modification de la production ou tâche de purge.

## État Git et périmètre

| Application | Worktree / branche | HEAD conservé |
| --- | --- | --- |
| Store | Magic_city_git / fix/store-product-loading | bf60c5fd781655200ff0431a41233841ceb9256a |
| Backend | Magic_city_backend_security / fix/backend-order-privacy | d6107db9221ab746867639c4b99f8c6b2ee8397e |
| Checkout | Magic_city_checkout_security / fix/checkout-guest-access, créé dans cette phase | 6b9c8b9 |

Les corrections Store phase B/intégration et les lots backend 1–8 sont conservés.
Le Checkout est construit depuis sa propre base, sans copier une autre branche.
Admin inchangé. server.ts reste en mode compatible, sans transport recovery.
La protection obligatoire des anciens endpoints invités reste désactivée.
Les nouveaux endpoints du pont imposent toujours leurs credentials.
Frais de livraison inactifs. Aucune tentative Store n'a été effacée.

## Rapport PASS/FAIL

| Contrôle | Résultat |
| --- | --- |
| Backend TypeScript / build / Prisma generate et validate | PASS |
| Backend contrats synthétiques | PASS — 29 |
| PostgreSQL lots 4 / 5 / 6 / 7 / 8 | PASS — 16 / 30 / 48 / 42 / 39 |
| PostgreSQL nouveau pont | PASS — 15 |
| Backend total | PASS — 219, aucun échec ou test ignoré |
| Store TypeScript application/configuration/tests, build | PASS — 1 719 modules |
| Store suites précédentes conservées | PASS — 78 |
| Store nouveaux tests UI d'appairage | PASS — 5 |
| Checkout TypeScript application/configuration/tests, build | PASS — 1 675 modules |
| Checkout API simulée / stockage / reprise / paiement / EUR | PASS — 23 |
| Total tests automatisés | PASS — 325 |
| Lint de tous les fichiers JS/TS modifiés dans cette phase | PASS — aucune erreur |
| git diff --check des trois worktrees | PASS |
| Parcours réel à deux origines dans un navigateur / mobile / retour Stripe | NON VALIDÉ — inventaire apps=[] et browsers=[] |
| Transport réel de récupération email | NON CONFIGURÉ |

Les tests clients remplacent fetch, utilisent des données synthétiques, et ne
contactent ni API publique ni Stripe. Un test Checkout laisse réellement passer
le délai de 15 secondes sur un corps de réponse bloqué, puis vérifie la conservation
du credential. Les tests React Test Renderer Store sont des simulations de
composants, pas une validation navigateur.

Les tests PostgreSQL lancent un cluster 17 neuf sur 127.0.0.1, rôle lot4_test,
base lot4_isolated, avec environnement synthétique limité et Stripe simulé.
Migrations historiques puis additives appliquées uniquement à cette base.
Dernier cluster tests/.pg-lot4-1791102332106 arrêté dans finally et conservé
localement, ignoré par Git. Le runner ne configure aucun service de production.

Le premier passage complet a également réexécuté le benchmark catalogue ;
tests/catalog-performance.json contient donc les nouvelles mesures locales du
runner. Les tableaux de LOT8_CATALOGUE.md restent le rapport historique précédent.
Les passages suivants utilisent --skip-benchmark, avec toutes les suites
fonctionnelles. Aucun nouveau gain de performance en production n'est revendiqué.

Lint : règles existantes sur TS/TSX clients ; règles ESLint recommandées et globals
Node sur runners .mjs. Backend : ESLint/typeScript-eslint disponibles dans le Store,
configuration explicite avec globals Node, no-unused-vars désactivé comme dans les
clients, no-require-imports désactivé pour les tests CommonJS. Aucune dépendance
backend ajoutée pour ce contrôle. Le lint global Store n'a pas été réexécuté :
ses trois erreurs préexistantes documentées dans STORE_BACKEND_INTEGRATION.md
ne sont pas corrigées dans cette phase.

## Protocole effectivement retenu

Pas de postMessage, opener, popup automatique, cookie tiers ou secret partagé
entre origines. Les onglets sont indépendants. Le lien Checkout est une navigation
explicite avec orderId public uniquement, target=_blank et noopener noreferrer.
Le Store reste ouvert pour l'accord. Aucun changement de COOP n'est nécessaire.

1. Le Store crée/reprend sa commande comme auparavant : même clé d'idempotence,
   même corps figé et même jeton. Il vérifie le total serveur avant de montrer
   le panneau d'appairage. Il ne redirige plus automatiquement hors du panier.
2. Le Checkout prépare son PROPRE jeton et l'enregistre dans son sessionStorage
   avant de demander un appairage. Il ne reçoit jamais le jeton brut Store.
3. Le Checkout affiche une référence publique de 192 bits et un code de contrôle
   de 12 chiffres hexadécimaux. L'utilisateur recopie la référence dans le Store.
4. Le Store authentifié inspecte l'appairage de SA commande, affiche le même code,
   puis demande un clic explicite attestant la comparaison.
5. Le backend lie le grant préparé Checkout à cette commande dans une transaction.
   La possession d'orderId, de pairingId ou du code de contrôle ne suffit jamais.
6. Le Checkout demande explicitement la vérification. Après accord seulement,
   il conserve authorized et lit la commande avec son token scoped.
7. /pay et /pay/confirm transmettent toujours Order-Access-Token. Aucun repli anonyme.
   Le sessionId Stripe connu est enregistré AVANT navigation vers Stripe.

Le code de contrôle est public : c'est une aide à la comparaison et à la prévention
des erreurs d'appairage, pas un mot de passe. L'utilisateur doit comparer avec
l'onglet Checkout qu'il souhaite réellement autoriser. Ce protocole ne protège
pas contre une XSS ou un utilisateur manipulé pour approuver un autre onglet.

## Contrats backend ajoutés

Toutes les routes ci-dessous sont sous /api, méthode POST JSON.
Le jeton est exclusivement dans Order-Access-Token.

| Route | Credential / entrée | Réponse |
| --- | --- | --- |
| /order-handoffs | Jeton Checkout préparé non lié ; {orderId} | {pairingId,orderId,phrase,expiresAt,state} |
| /orders/:id/handoffs/:pairingId/inspect | Jeton Store déjà lié à :id ; {} | Vue publique de l'appairage, sans credential |
| /orders/:id/handoffs/:pairingId/approve | Même preuve Store ; {} et action utilisateur explicite | Vue publique, state=approved |
| /order-handoffs/:pairingId/redeem | Jeton destinataire Checkout ; {} | Vue publique ; après accord expiresAt est la date du grant |

Création et rédemption : Origin exact Checkout. Inspection/approbation : Origin
exact Store. Valeurs production par défaut :
https://magiccitydrip.shop et https://dripcheckout.netlify.app.
Les origines staging sont injectées explicitement dans createApp({handoffOrigins:
{store:origineStore,checkout:origineCheckout}}), jamais déduites d'une query,
du corps ou d'un message. Origin/CORS complètent les preuves par token et ne
constituent pas une authentification indépendante.

CORS du pont : origine exacte, POST/OPTIONS, Content-Type et Order-Access-Token,
Vary:Origin. Origine absente, null ou ressemblante refusée, y compris sur chemins
de casse différente. Cache-Control:no-store, Pragma:no-cache et
Referrer-Policy:no-referrer présents aussi sur erreurs. Jetons connus en query
refusés. Routes exclues de Morgan. Aucun raw token persisté dans OrderHandoff.

Erreurs : 401 HANDOFF_DENIED / ORDER_ACCESS_DENIED ; 403 HANDOFF_ORIGIN_DENIED ;
409 HANDOFF_CONFLICT ; 410 HANDOFF_EXPIRED ; 429 HANDOFF_RATE_LIMIT avec
Retry-After:60 ; 503 HANDOFF_RETRY. Pas de corps confidentiel dans les messages
client ou console. Le Checkout applique Retry-After avec une échéance persistée.

## Atomicité, idempotence et expiration

- Un recipientHash UNIQUE ne peut avoir qu'un appairage. Même token, commande et
  origine : même référence/réponse. Demande différente : 409. Cette contrainte est
  réellement testée dans PostgreSQL.
- Verrou transactionnel consultatif sur la référence de commande pour quotas,
  puis verrou du grant pendant la création. Aucune lecture d'existence de commande
  nécessaire : une référence inexistante ne révèle pas son inexistence.
- Approbation/rédemption : commande verrouillée en premier, puis appairage et grants.
  Même ordre principal que révocation/recovery. Accès source actif et lié à CETTE
  commande revérifié dans la transaction ; destinataire non lié ou déjà lié au
  même ordre pour le replay. Liaison et approvedAt sont atomiques.
- Injecter une erreur après liaison annule toute l'approbation. La reprise réussit
  avec les mêmes références. Aucune commande, réservation ou session Stripe créée
  par le pont.
- Appairage pending valable cinq minutes au maximum, borné aussi par la préparation
  de quinze minutes. Après accord, grant valable 30 jours, sans prolongement lors
  des lectures/replays. Rédemption d'un accord acquis reste possible après la fenêtre
  de cinq minutes, tant que le grant est actif.
- Révocation Admin et recovery vérifiée invalident les appairages de l'ordre dans
  la même transaction, ainsi que les anciens grants. Approbation concurrente ne
  ressuscite pas un grant révoqué.
- Quota persistant : dix appairages par référence de commande et par heure.
  Limite locale supplémentaire : soixante requêtes par IP/minute, mémoire bornée.
  Aucune tâche automatique d'expiration/purge ; dates contrôlées à l'utilisation.

## Reprises et limites clients

- Store : erreur d'approbation ou réponse perdue → même pairingId et token.
  Inspection ne donne pas implicitement l'accord. Modification du code saisi
  supprime le précédent bouton d'autorisation. Clé, payload et accès Store inchangés.
- Checkout : préparation/réponse d'appairage perdue → token déjà sauvegardé réutilisé.
  Double clic dédupliqué en mémoire. Trois préparations au maximum par tentative.
- Une expiration locale de pairing n'est pas une preuve d'échec. Avant un
  renouvellement explicite, Checkout relit /redeem. Un accord acquis conserve le
  token. Seul 410 HANDOFF_EXPIRED autorise le remplacement d'un grant pending.
  Network/503/401 ne provoquent aucune rotation.
- Stockage indisponible : blocage avant les opérations. Les tokens restent uniquement
  en sessionStorage par orderId, pas dans localStorage, URLs, logs ou React Query.
- /pay perdu/timeout : quatre soumissions au maximum, persistées ; même orderId.
  Backend lot 5 récupère sa tentative/session stable. Une ancienne URL n'est pas
  naviguée sans relecture /pay. Un sessionId connu différent bloque pour vérification
  plutôt que remplacer silencieusement la session.
- Retour Stripe : session_id doit coïncider avec la session enregistrée et le credential
  de l'ordre. Confirmation puis lecture minimale vérifiées, montants en EUR réels,
  sans division par 100 ni USD. Panier Checkout vidé seulement après paid ET état PAID.
  Le panier Store reste soumis à sa vérification backend scoped habituelle.
- Confirmation : trois lectures au maximum par montage de page, reprises explicites,
  sans retry automatique. Refresh recommence ce budget de lecture ; garanties de
  finalisation idempotente restent côté backend.
- Reload avec sessionStorage conservé : reprise même appairage/ordre/session.
  Fermeture Checkout : ouvrir explicitement un nouveau Checkout pour la même commande
  et l'autoriser depuis le Store encore authentifié. Le backend réutilise la session
  active ; un ordre déjà PAID est affiché sans nouveau /pay.
- Perte des DEUX credentials : récupération vérifiée indispensable.
  Le transport email reste non configuré. Aucun accès délivré sur orderId/email seuls.
  Pas de promesse de récupération automatique dans ce cas.
- Une confirmation avec session inconnue dans la nouvelle fenêtre est bloquée :
  revenir à l'appairage/lecture minimale de cette commande ou à l'assistance.

## Migration additive et fichiers modifiés

Backend (drip_backend/, dans le worktree dédié) :
- src/services/orderHandoff.ts — nouveau service transactionnel.
- src/routes/orderHandoffRoutes.ts — nouvelles routes, origine stricte et limites.
- src/services/guestOrderAccess.ts — révocation du pont lors de revoke/recovery.
- src/app.ts — montage, CORS spécifique, privacy/logs, injection staging.
- prisma/schema.prisma — modèle OrderHandoff et relation GuestOrderAccess.
- prisma/migrations/20261004230000_add_order_handoff/migration.sql — nouvelle table,
  unicité recipientHash, FK RESTRICT vers GuestOrderAccess, index par référence/date.
- tests/handoff.integration.test.cjs — quinze tests PostgreSQL.
- tests/run-postgres-tests.cjs — migration additive et suite ; --skip-benchmark.
- tests/catalog-performance.json — réécrit par la réexécution du benchmark existant.
- tests/HANDOFF.md — référence vers ce rapport.

expectedOrderId est une référence publique, volontairement sans FK Order ni lecture
d'existence à la création. Aucun accès ne peut être accordé sans grant source lié à
un ordre réel. Aucun backfill, recalcul de commande, migration destructive ou purge.
Migration appliquée uniquement à PostgreSQL synthétique dans cette phase.

Store (drip_frontend/) :
- src/components/CheckoutHandoff.tsx — panneau inspection/comparaison/approbation.
- src/lib/handoffLink.ts — origine Checkout de build explicite, lien public validé.
- src/pages/Cart.tsx — appairage après confirmation du total au lieu de redirection.
- scripts/run-tests.mjs — suite additionnelle.
- tests/checkout-validation.test.tsx, store-backend-integration.test.tsx — attentes
  de navigation adaptées au nouvel accord manuel, autres assertions conservées.
- tests/store-handoff.test.tsx — cinq régressions UI.
- tests/STORE_CHECKOUT_HANDOFF.md — présent rapport.

Checkout (seamless_checkout_flow/, dans le nouveau worktree) :
- src/lib/secureCheckout.ts — transport, stockage, appairage, paiements/reprise/EUR.
- src/pages/CheckoutLanding.tsx, OrderConfirmation.tsx — parcours scoped.
- index.html — document no-referrer.
- package.json — scripts typecheck/test uniquement ; déclarations de dépendances inchangées.
- package-lock.json — retrait de 27 866 NUL finaux PRÉEXISTANTS dans le blob 6b9c8b9.
  Son JSON utile et ses versions verrouillées sont conservés à l'identique ; npm ci
  et contrôles finaux réalisés avec ces versions. L'installation exploratoire avait
  recalculé le lockfile ; ce recalcul a été annulé avant validation finale.
- scripts/run-tests.mjs, tsconfig.tests.json, tests/secure-checkout.test.ts.
- tests/HANDOFF.md — référence vers ce rapport.

Échecs intermédiaires corrigés : lockfile Checkout corrompu, décodage Prisma du type
void du verrou PG, typage du mock de corps lent. Aucun échec final.
Avertissements Browserslist et LF/CRLF non bloquants.

## Validation staging restante et rollback

Aucune infrastructure de staging déployée dans cette phase. Avant toute production :

1. Deux origines staging indépendantes explicites, backend isolé et base synthétique ;
   client Stripe simulé avec page de paiement locale dédiée. Ne pas rediriger le
   navigateur vers un vrai Stripe pour ces simulations. Le Checkout valide actuellement
   uniquement checkout.stripe.com pour naviguer : le simulateur navigateur devra
   intercepter cette destination dans un harness isolé, ou une adaptation dédiée du
   harness devra être autorisée/validée, sans élargir la liste production implicitement.
2. Builds Store VITE_API_URL + VITE_CHECKOUT_ORIGIN ; Checkout VITE_PRIMARY_API_URL +
   VITE_STORE_ORIGIN, valeurs locales/staging explicites. Origines loopback HTTP admises
   uniquement pour les liens locaux ; HTTPS pour les autres. Aucun changement de variable
   de production réalisé. Backend createApp avec handoffOrigins correspondantes.
3. Chrome/Edge/Firefox desktop, Safari iOS, Chrome Android et webviews pertinentes :
   deux onglets, liens bloqués/ouverts dans même onglet, COOP strict, copie de référence,
   comparaison/approbation, reload et retour/avance, fermeture de chaque onglet à chaque étape,
   sessionStorage bloqué/effacé, perte de réseau et réponses prepare/create/approve/redeem/pay.
4. Ordres A/B, autre token, token expiré/révoqué, ancienne commande ; double clic,
   prix total EUR 9,90 et 99,90, session retournée différente, ancien retour Stripe,
   retour dans un autre onglet, paiement déjà validé, conservation du panier Store.
5. DevTools/proxy/APM/analytics : aucun Order-Access-Token, corps prepare, secret recovery
   ou credential dans URL/referer/console/capture. Les logs applicatifs du pont sont
   exclus ; l'hébergement et les outils tiers ne sont pas validés ici.
6. Contrôler limitations distribuées et IP derrière proxy, consommation quotas,
   CSP/XSS, et UX de comparaison. Appairage explicite n'est pas une navigation transparente.

Rollback futur uniquement après autorisation : conserver tables additives, grants,
tentatives et clés. Ne pas effacer du stockage pour résoudre un timeout. Garder les
endpoints du pont tant que des Checkout adaptés les utilisent. Une restauration des
anciens clients réintroduit les accès anonymes et doit être évaluée explicitement.
Ne pas rollback les garanties de paiement/stock/idempotence pour un problème d'UX.
Activation obligatoire, transport email réel et déploiement exigent une autorisation
distincte et ne sont pas exécutés.

Résultat : PASS automatisé et migration synthétique ; validation navigateur/staging
incomplète. Aucun feu vert de déploiement donné. La phase s'arrête ici.
