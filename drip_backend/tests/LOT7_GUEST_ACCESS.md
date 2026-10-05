# Lot 7 — accès aux commandes invitées

Validation locale du 4 octobre 2026 (Africa/Tunis).
Worktree : Magic_city_backend_security. Branche : fix/backend-order-privacy.
Base inchangée : d6107db9221ab746867639c4b99f8c6b2ee8397e.
Les lots 1 à 6 sont conservés ; toutes leurs suites sont réexécutées.

## Rapport PASS/FAIL

| Contrôle | Résultat |
| --- | --- |
| TypeScript, npm run typecheck | PASS |
| Build, npm run build (également exécuté par les deux commandes de tests) | PASS |
| Prisma generate / validate avec URL localhost synthétique | PASS |
| Tests de contrats synthétiques existants | PASS — 29 |
| PostgreSQL : idempotence, lot 4 | PASS — 16 |
| PostgreSQL : paiements, lot 5 | PASS — 30 |
| PostgreSQL : réservations, lot 6 | PASS — 48 |
| PostgreSQL : accès invité, lot 7 | PASS — 42 |
| Total | PASS — 165, aucun échec ni test ignoré |
| git diff --check | PASS |
| Protection obligatoire déployée | NON ACTIVÉE, conformément au déploiement progressif demandé |
| Livraison de récupération réelle / parcours navigateur inter-applications | NON VALIDÉS : clients non modifiés, transport réel non configuré |

Le runner démarre un PostgreSQL 17 neuf sur 127.0.0.1, avec une base lot4_isolated,
sans hériter des variables de base, Stripe ou JWT du shell. Il applique d'abord
les migrations historiques, crée une commande synthétique avant les migrations,
puis applique les quatre migrations additives des lots 4 à 7.
Le client Stripe est simulé ; aucun appel à un compte Stripe ni paiement réel.
Le dernier cluster tests/.pg-lot4-1791093746386 est arrêté dans finally et conservé
localement, ignoré par Git. Les anciens clusters de validation sont aussi arrêtés.

Une erreur d'échappement dans l'assertion initiale du nouveau fichier de test
a été corrigée avant la validation finale. Aucun échec final ou régression
des suites existantes. Aucun fichier client, variable de production, service
de production ou donnée de production n'a été modifié. Aucun commit, push,
merge ou déploiement. Frais de livraison inactifs. Lot 8 non commencé.

## Comportement et sécurité

- Jeton généré avec node:crypto.randomBytes(32), soit 256 bits, encodé base64url
  sur 43 caractères. Seule l'empreinte SHA-256 est persistée.
- Préparation avant la commande, valable 15 minutes pour sa liaison.
  Liaison dans la même transaction PostgreSQL que commande, idempotence et stock.
  Un jeton préparé ne permet aucune consultation tant qu'il n'est pas lié.
- Après liaison, accès valable 30 jours. Aucun prolongement automatique lors
  de lectures, paiements ou reprises. Expiration contrôlée à chaque autorisation.
  La réservation de stock et l'expiration Stripe du lot 6 restent indépendantes :
  posséder un jeton valide ne prolonge pas le droit de payer une commande expirée.
- Une empreinte ne peut être liée à deux commandes : verrou PostgreSQL et
  vérification de la liaison. Une seconde liaison annule toute la transaction,
  y compris le stock, la remise et la commande.
- Le jeton ne remplace jamais le JWT Admin. Les routes Admin existantes
  gardent leur authentification, leurs formes de réponse et leurs mutations.
- Révocation Admin explicite : révoque les accès et les défis de récupération
  encore utilisables. La récupération vérifiée peut ultérieurement délivrer
  un nouvel accès ; la révocation ne supprime ni commande ni paiement.
- Les requêtes déjà autorisées avant une révocation peuvent terminer leur
  opération. Ce contrôle n'est pas une annulation transactionnelle rétroactive
  d'une opération Stripe ou d'une réponse déjà en cours.

Mode actuel : createApp() utilise orderAccessRequired=false.
Sans en-tête, les clients historiques gardent leurs contrats, y compris les
routes invitées. Si un en-tête est présent, sa validation est obligatoire :
aucun repli anonyme en cas de jeton invalide, expiré, révoqué ou d'une autre commande.

IMPORTANT : pendant ce mode compatible, omettre l'en-tête reste possible.
L'exposition anonyme des routes invitées n'est donc pas encore supprimée.
La protection finale exige l'activation coordonnée décrite plus bas.

Le mode obligatoire est disponible via createApp({orderAccessRequired:true})
et testé localement, mais le démarrage src/server.ts ne l'active pas.
Il protège GET /orders/:id/min, POST /pay et GET /pay/confirm, et impose
un jeton préparé pour POST /checkout/intent et POST /orders.
Les webhooks continuent à utiliser exclusivement leur signature Stripe ;
aucun jeton invité ne leur est demandé.

### Confirmation et sessions Stripe

La confirmation ne se fie jamais à un orderId fourni par le client.
Elle retrouve le propriétaire depuis PaymentAttempt.sessionId ou le champ
stripeSessionId historique. Si Stripe a créé une session mais que son identifiant
n'a pas été enregistré, un jeton valide est d'abord vérifié, puis la session
est relue avec le client Stripe et sa metadata.order_id doit correspondre.
La finalisation du lot 5 recontrôle session, tentative, montant, devise et paiement.

Une session inconnue ou indisponible lors de cette récupération retourne
503 ORDER_ACCESS_RETRY, sans donner ses données. Une discordance de commande
retourne 401 ORDER_ACCESS_DENIED. Aucun appel Stripe de récupération n'est
effectué pour un jeton inconnu, expiré ou révoqué.

### Idempotence et réponses perdues

La préparation préalable résout une contrainte essentielle : on ne peut pas
réémettre le même secret aléatoire à partir de sa seule empreinte.
Le client connaît donc le jeton avant la création et le conserve avant l'appel.

Le fingerprint d'une demande avec jeton inclut son empreinte, jamais le secret.
La réponse stockée dans OrderIdempotency ne contient ni jeton ni empreinte
d'accès. Une reprise avec même clé, demande et jeton retourne exactement
la même réponse. Un changement ou retrait du jeton avec cette clé provoque
409 IDEMPOTENCY_CONFLICT. Un accès révoqué ne permet pas de relire ce snapshot.

Pour les anciennes demandes sans jeton, le fingerprint et les réponses sont
inchangés. Ne jamais créer une nouvelle clé après un timeout d'une tentative
existante. Une réponse perdue du seul endpoint de préparation ne crée
aucune commande : une nouvelle préparation est alors possible.

## Contrats API additionnels

Préfixe commun /api. Corps JSON. Aucune URL ne transporte un secret.

| Endpoint | Entrée | Réponse |
| --- | --- | --- |
| POST /order-access/prepare | Aucun corps nécessaire | 201 {accessToken, expiresAt} |
| POST /checkout/intent ou /orders | Corps existant, Order-Access-Token facultatif et Idempotency-Key existant | Réponse historique inchangée |
| GET /orders/:id/min | Order-Access-Token facultatif actuellement | Réponse historique inchangée |
| POST /pay | {orderId}, Order-Access-Token facultatif actuellement | {url, sessionId}, inchangé |
| GET /pay/confirm?session_id=... | Order-Access-Token facultatif actuellement | Réponse historique inchangée |
| POST /order-access/recovery | {orderId, email} | 202 {ok:true}, si transport configuré |
| POST /order-access/redeem | {recoveryToken} | 200 {orderId, accessToken, expiresAt} |
| POST /admin/orders/:id/revoke-access | JWT Admin | 200 {ok:true} |

Erreurs d'accès communes :
- 401 ORDER_ACCESS_DENIED pour credentials absents en mode obligatoire,
  incorrects, expirés, révoqués, non liés ou d'une autre commande.
- 400 ORDER_ACCESS_HEADER_REQUIRED si un paramètre URL connu transporte
  un jeton d'accès ou de récupération.
- 503 ORDER_ACCESS_RETRY en cas d'indisponibilité technique.
- 503 ORDER_RECOVERY_UNAVAILABLE tant que le transport n'est pas configuré.
- 429 ORDER_ACCESS_RATE_LIMIT et Retry-After:60 pour la limitation locale.

Les en-têtes CORS autorisent Order-Access-Token.
Toutes les réponses des routes sensibles, y compris les erreurs, portent
Cache-Control:no-store, Pragma:no-cache et Referrer-Policy:no-referrer.
L'API n'insère pas le jeton dans redirectUrl, les URLs Stripe, les métadonnées
Stripe ou les réponses d'erreur.
Les paramètres orderId et session_id historiques restent présents ;
ils ne sont jamais traités comme preuve d'autorisation en mode obligatoire.

## Récupération vérifiée des anciennes commandes

L'identifiant de commande, même accompagné de l'adresse email correcte,
ne délivre pas un jeton d'accès. La demande retourne un accusé générique.
Seul un secret aléatoire reçu à l'adresse customerEmail déjà enregistrée
permet la récupération. Il expire en 15 minutes et ne sert qu'une fois.

Le transport est une dépendance explicite orderRecoveryDelivery de createApp,
non configurée dans le serveur actuel. Il doit livrer le secret au destinataire
fourni par le backend, jamais à une adresse substituée par le demandeur.
Aucun email réel n'a été envoyé : livraison simulée uniquement dans les tests.

Au maximum cinq défis par commande et par heure, contrôlés sous verrou de la
commande dans PostgreSQL. Aucun quota n'est consommé sur une adresse différente.
La récupération réussie révoque tous les anciens accès et tous les défis
restants, puis crée un nouveau jeton dans une seule transaction. Les requêtes
concurrentes et la révocation Admin utilisent le même ordre de verrous.

Un échec ou timeout de livraison (5 secondes) invalide le défi ; réponse
générique sans log du secret. Le client peut redemander après une réponse
de récupération perdue ; aucun secret brut ne peut être restauré depuis la base.

Les anciennes commandes ne reçoivent pas de jeton implicite lors de la migration,
d'une lecture, d'un appel /pay ou d'un redémarrage.
Un accès récupéré ne remplace pas la vérification des réservations historiques
du lot 6 : LEGACY_RESERVATION_REVIEW peut toujours bloquer une ancienne commande
impayée jusqu'à l'action Admin explicitement vérifiée.

## Journaux et limites de divulgation

Morgan ne journalise aucune URL, query string ou en-tête.
Les routes commande, paiement, Admin, checkout, récupération et webhook restent
exclues de ce journal d'accès. Les erreurs des contrôleurs de commande n'impriment
plus les exceptions susceptibles de contenir des données.
Les erreurs de parsing JSON sont transformées en réponse générique, sans corps
de demande ou page d'erreur Express contenant le secret.

Cela couvre les logs générés par cette application. Les traces du reverse proxy,
de l'hébergeur, des outils APM, des extensions navigateur et du fournisseur
de notification ne sont ni configurées ni vérifiées ici. Il faut y masquer
Order-Access-Token, les corps prepare/redeem/recovery et les payloads de livraison.
Ne jamais inclure les jetons dans une URL, même pour faciliter une redirection.

Limitation locale des trois endpoints /order-access : 60 requêtes par minute,
par chemin normalisé et IP, mémoire bornée à 10 000 entrées.
Pas de minuterie ou tâche de purge : nettoyage opportuniste du compteur
lors des demandes. Cette limitation est par processus, non distribuée ;
derrière le proxy par défaut elle peut agréger plusieurs clients sous une IP.
Une politique de limitation au proxy doit être vérifiée avant exposition large.
Les lignes de jetons expirés restent en base ; aucune purge de base n'est
programmée ou planifiée.

## Modifications exactes des clients à préparer — non implémentées

Code des versions déployées vérifié avec git show/git grep, sans checkout :
Store bf60c5f, Checkout 6b9c8b9, Admin d0c2248.
Les modifications locales du Store restent sur fix/store-product-loading.

### Store

- drip_frontend/src/services/api.ts : permettre l'en-tête Order-Access-Token
  explicitement par appel sensible, conserver timeouts/annulation, exclure
  cet en-tête et les réponses prepare/redeem de toute journalisation.
- drip_frontend/src/services/orderService.ts : ajouter la préparation et
  envoyer l'en-tête à /checkout/intent ; aucune modification du corps métier.
- drip_frontend/src/lib/checkoutAttempt.ts (travail local phase B) :
  enregistrer dans sessionStorage une tentative avec clé d'idempotence stable
  et jeton préparé AVANT l'appel de création. Conserver les deux après timeout,
  réponse perdue, refresh et nouvelle tentative ; aucun renouvellement silencieux.
  expiresAt de prepare est la limite de liaison, pas l'expiration finale
  après liaison. Ne pas jeter un jeton à 15 minutes après une création réussie
  ou dont le résultat reste incertain.
- drip_frontend/src/pages/Cart.tsx et src/hooks/useCheckout.ts :
  utiliser cette tentative ; bloquer les doubles clics, traiter 401/409/429/503,
  ne jamais changer la clé pour contourner une réponse incertaine.
- drip_frontend/src/components/layout/Layout.tsx et src/lib/paidOrderCheck.ts
  local : envoyer le jeton de la commande vérifiée à /orders/:id/min.
  Ne vider le panier qu'après paiement confirmé ; absence de jeton ou 401
  conduit à récupération explicite, pas à une boucle de retry ni à une suppression.
- Préparer une interface de récupération par email puis secret livré,
  sans stocker ce secret dans localStorage, dans l'URL ou les analytics.

### Transmission Store → Checkout sans jeton dans l'URL

Le Store actuel fait window.location.href=redirectUrl ; les sessionStorage
des deux origines ne sont pas partagés. Une simple sauvegarde côté Store
ne suffit donc pas. Il faut modifier explicitement ce parcours.

Solution proposée, à valider en navigateur avant activation :
1. Ouvrir une fenêtre Checkout depuis le clic utilisateur et garder sa référence
   dans le Store ; en cas de blocage de popup, présenter une reprise explicite.
2. Après création, naviguer cette fenêtre vers le redirectUrl existant
   contenant seulement orderId.
3. Checkout envoie à window.opener un message ready avec orderId et un nonce
   aléatoire ; Store valide origin exact, source égal à la fenêtre ouverte,
   commande attendue et nonce, puis répond via postMessage avec targetOrigin exact.
4. Checkout valide origin du Store, source égal à opener et nonce attendu,
   conserve le jeton dans son sessionStorage avant tout appel sensible et acquitte.
   Répétition possible si message perdu, pour la même commande uniquement.
5. Après acquittement, supprimer les listeners et rompre l'opener.
   Ne pas employer targetOrigin="*", un fragment URL, un paramètre de query
   ou localStorage comme mécanisme de transfert du secret.

Vérifier les politiques COOP et le comportement mobile/popup dans le staging
isolé ; ne pas affaiblir ces politiques implicitement. Si ce parcours est refusé
ou impossible, prévoir séparément un pont serveur authentifié / cookie sécurisé
sur une origine adaptée, avant l'activation obligatoire. Aucun pont supplémentaire
ou jeton de transfert en URL n'est implémenté dans le présent lot.

### Checkout

- seamless_checkout_flow/src/pages/CheckoutLanding.tsx :
  recevoir le jeton par le canal vérifié, attendre sa disponibilité,
  l'associer à orderId, puis envoyer Order-Access-Token lors du GET minimal
  et du POST /pay. Garder le jeton lors de la navigation Stripe dans le même onglet.
- seamless_checkout_flow/src/pages/OrderConfirmation.tsx :
  récupérer le jeton de sessionStorage à partir de la commande attendue et
  l'envoyer à /pay/confirm. session_id ou orderId seuls n'autorisent plus
  la confirmation après activation.
- Ajouter un petit module API/accès commun pour ces deux pages, avec erreurs
  bornées : 401 → récupération, 409 → état métier/réconciliation, 503 → retry
  borné avec la même session/commande, sans création de nouvelle commande.
- En cas de retour Stripe dans un autre onglet, stockage effacé ou lien partagé,
  demander une récupération vérifiée ; jamais reconstituer un accès depuis orderId.
- Ajouter le parcours de récupération et de rédemption, conserver le nouveau
  jeton avant la reprise. Ne journaliser ni fetch options, ni tokens, ni réponses
  sensibles. Éviter le cache React Query persistant de ces credentials.

### Admin

admin-drip/src/services/api.ts et src/services/orderService.ts utilisent
Authorization:Bearer JWT et /admin/orders : aucun changement obligatoire.
Une action UI explicite de révocation pourrait appeler le nouvel endpoint
avec le JWT existant, sous une autorisation ultérieure.
Un jeton invité ne doit jamais être ajouté aux appels Admin.

Dans les deux clients : politique Referrer-Policy:no-referrer sur les documents,
suppression des secrets des traces et analytics, durées de conservation bornées,
et CSP/XSS à vérifier. Le sessionStorage est accessible au JavaScript de l'origine :
les jetons restent des capacités porteuses, leur vol par XSS n'est pas résolu
par le hachage côté serveur. Ne pas supprimer trop tôt la tentative incertaine.

## Séquence progressive et rollback

1. Backend compatible : après autorisation de déploiement distincte, appliquer
   la migration additive, déployer ce code avec orderAccessRequired=false.
   Préparer le transport de récupération réel et la limitation au proxy
   sans encore imposer les jetons.
2. Adapter Store et Checkout sous autorisation distincte. Toujours compatible
   pendant la transition. Valider transfert de secret, reprises de création,
   retour Stripe, ancienne commande et récupération avec données synthétiques.
3. Valider le staging de bout en bout : fenêtres, reload, onglet fermé,
   timeout, reprise après redémarrage, isolation A/B, JWT Admin, historiques,
   logs du proxy, notification et navigateur. Les paiements restent simulés.
   Vider/drainer les tentatives anciennes sans jeton ou prévoir leur résolution
   vérifiée ; une vieille clé sans jeton ne peut pas être convertie implicitement.
4. Seulement après autorisation explicite, modifier le point de construction
   de l'application pour appeler createApp({orderAccessRequired:true,
   orderRecoveryDelivery:transportVerifie}) et déployer cette activation.
   Aucune variable de production n'est créée ou modifiée dans ce lot.
5. Vérifier refus anonyme et conservation des parcours clients réels sous
   surveillance sans données sensibles.

Rollback proposé :
- Avant activation : revenir au backend lot 6 si nécessaire, garder les tables
  additives en place ; pas de suppression/recalcul des commandes.
- Après activation : préférer corriger le client ou le transport. Si autorisé,
  revenir à la version compatible rétablit l'accès anonyme et constitue donc
  une régression de confidentialité explicite ; ne pas le faire automatiquement.
- Garder les tables et empreintes lors d'un rollback, ainsi que les clients
  adaptés si possible. Aucune migration destructive de retour proposée.
- Ne jamais rollback les garanties stock/paiement/idempotence des lots 4 à 6
  pour résoudre une erreur de jeton.

## Migration et fichiers du présent lot

Migration additive :
prisma/migrations/20261004190000_add_guest_order_access/migration.sql.
Deux nouvelles tables GuestOrderAccess et GuestOrderRecovery, clés primaires
sur empreinte, dates d'expiration/révocation/utilisation, références Order
RESTRICT et index de commande. Aucune donnée historique transformée ou backfill.
Aucune migration exécutée hors PostgreSQL synthétique isolé.

Fichiers ajoutés :
- src/services/guestOrderAccess.ts
- src/middlewares/guestOrderAccess.ts
- src/controllers/guestOrderAccessController.ts
- prisma/migrations/20261004190000_add_guest_order_access/migration.sql
- tests/guest-access.integration.test.cjs
- tests/LOT7_GUEST_ACCESS.md

Fichiers existants modifiés dans ce lot :
- prisma/schema.prisma
- src/services/orderIdempotency.ts
- src/controllers/orderController.ts
- src/routes/orderRoutes.ts
- src/app.ts
- tests/run-postgres-tests.cjs

Aucune dépendance ajoutée. package.json et les autres fichiers modifiés
précédemment restent ceux des lots antérieurs. Les avertissements Git LF/CRLF
sont des avertissements de conversion Windows, pas des échecs de diff.

## Risques et limites résiduels

- Mode compatible laisse les parcours invités anonymes ouverts jusqu'à
  l'activation coordonnée ; le PASS concerne le support facultatif validé,
  pas la suppression déjà effective de cette exposition.
- Notification réelle, transfert inter-origines, redirections Stripe dans le
  navigateur et masquage des logs d'hébergement restent à valider.
- Réponses de récupération génériques, mais temps de réponse non uniformisé :
  transport plus lent qu'une demande invalide. Aucune garantie de temps constant.
- Limitation par processus uniquement ; vérifier proxy, IP et protection
  distribuée contre la création massive de jetons avant ouverture large.
- Compromission email/XSS vole une capacité d'accès ; rotation et révocation
  sont disponibles mais ne remplacent pas la sécurisation des clients.
- Une réponse de rédemption perdue exige une nouvelle récupération, puisque
  le jeton brut n'est pas conservé et ne peut pas être rejoué depuis la base.
- Aucun job d'expiration ou purge. Expiration appliquée aux contrôles d'accès
  sans effacer les lignes ni les clés d'idempotence ; aucune purge planifiée.
- Les anciennes commandes impayées restent soumises à la vérification du
  stock du lot 6 ; récupération d'accès et réservation sont deux actions distinctes.

Le lot 7 s'arrête ici. Toute adaptation client, activation obligatoire,
notification réelle, déploiement ou lot 8 attend une nouvelle autorisation.
