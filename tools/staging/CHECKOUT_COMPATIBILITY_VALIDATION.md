# Phase E — compatibilité des parcours Checkout

4 octobre 2026. Phase F et staging distant non commencés. Rapport final :
validation automatisée PASS après arrêt du lanceur par l’utilisateur. Aucun
processus n’a été arrêté de force. Validation navigateur toujours non effectuée.

## Rapport PASS/FAIL

| Contrôle effectué dans cette phase | Résultat |
| --- | --- |
| TypeScript Backend, Store et Checkout | PASS |
| Builds Backend, Store, Checkout historique et Checkout préfixé séparés | PASS |
| Prisma validate | PASS |
| Prisma generate | PASS — relancé après libération de la DLL |
| Contrats backend synthétiques | PASS — 29 |
| Suites PostgreSQL backend complètes, base neuve isolée du runner | PASS — 190 |
| Store | PASS — 85 |
| Checkout | PASS — 51 |
| Transfert/paiement/compatibilité simulés, sources réelles | PASS — 20 |
| Total des suites exécutées | PASS — 375, aucun échec/test ignoré |
| Bundles production, deux modes et deux applications | PASS — 4 |
| Lint fichiers modifiés, git diff --check | PASS |
| Inventaire du cluster actif, transaction READ ONLY | PASS |
| Nouveau scénario staging complet | PASS — 28 contrôles, aucun échec |
| Routage HTTP Store / Checkout préfixé et historique | PASS — 6 contrôles |
| Navigateur automatisé | NON DISPONIBLE — apps=[] et browsers=[] |
| Accès invité obligatoire côté serveur | NON ACTIVÉ — exposition compatible résiduelle |

Le premier validateur avait terminé avec code 1 à cause de Prisma generate.
La relance finale de validate.cjs termine avec code 0 et tous les contrôles PASS. Les 190 tests PostgreSQL utilisent leur propre cluster et
Stripe simulé ; ils ne dépendent pas du staging manuel actif. Les tests clients
simulent fetch/React/Window et ne valident pas un navigateur. Les 28 scénarios sont désormais exécutés et PASS dans cette phase ; ils
conservent les 26 contrôles de phase D et ajoutent les deux contrôles de compatibilité.

## Inventaire et preuves

Branches et bases conservées : Store fix/store-product-loading à bf60c5f ;
backend fix/backend-order-privacy à d6107db ; Checkout fix/checkout-guest-access
à 6b9c8b9. Les sources backend sont examinées, sans correction de règles métier.
Admin et versions déployées inchangés. Aucun appel aux services de production.

Le cluster actif run-1791132357910 a été interrogé exclusivement dans une
transaction PostgreSQL REPEATABLE READ / READ ONLY. Aucun token, email, adresse,
identifiant de commande, clé d'idempotence ou empreinte d'accès n'est exporté.
COMPATIBILITY_ACTIVE_INVENTORY.json contient seulement des nombres et états agrégés :

| Montant EUR | Statut paiement / commande | Nombre |
| --- | --- | --- |
| 9,90 | PAID / PROCESSING | 2 |
| 11,00 | PAID / PROCESSING | 1 |
| 22,00 | PAID / PROCESSING | 1 |
| 12,34 | PENDING / PENDING | 1 |

Quatre sessions communes payées, aucune session historique dans ce cluster,
quatre tentatives de paiement, quatre claims d'idempotence, quatre grants et
aucun appairage. Ces chiffres sont un snapshot, pas une reconstitution du navigateur.
Les sessions expirées/historiques sont couvertes par les suites synthétiques ;
on n'en invente pas dans les données actives. Les autres clusters arrêtés ne sont
pas démarrés ni réinitialisés pour cet inventaire. Le stockage du navigateur
utilisateur n'est pas accessible et n'a pas été lu ou effacé.

### États persistants démontrés par le code

- Store : sessionStorage magic-city-drip-checkout-pending contient demande figée,
  clé stable, jeton, budget, résultat connu et estimation confirmée. Le résultat
  perdu se reprend avec les mêmes données. L'ancien marqueur opaque pending
  reste bloqué ; on ne lui invente aucune clé. L'accès des commandes précédentes
  est conservé dans magic-city-drip-order-access lors d'un achat distinct explicite.
- Association commune : magic-city-common-checkout-v1:ORDER, version/order/token/key,
  jamais URL. Elle ne doit pas être écrasée. Checkout exige un GET scoped vérifié.
- Checkout : drip-checkout-guest-v1:ORDER conserve son grant, autorisation,
  pairing éventuel, sessionId/URL, budgets et Retry-After. Un autre ordre/token/session
  est refusé. Le pont historique prépare un grant destinataire distinct puis le
  lie après approbation explicite ; il reste en place.
- Backend : OrderIdempotency conserve clé unique/fingerprint/réponse ; les grants
  ne conservent que les empreintes. PaymentAttempt conserve commande, montant en
  centimes, devise, clé Stripe, request JSON figée, session et génération. Les
  sessions actives sont relues ; une réponse perdue ne change pas leur clé.
- Le simulateur conserve séparément ledger/key/request/payload et destination
  stagingReturnBase. Les anciens payloads sans cette propriété restent historiques.
  Une demande depuis l'autre parcours bloque, sans changer la destination.
- Un passage EXPIRED peut entraîner une nouvelle génération selon les règles
  préexistantes si la réservation le permet ; ce n'est jamais un changement
  de destination ni une correction automatique de compatibilité. Le client
  refuse de remplacer silencieusement un sessionId déjà connu.

Les dates seules ne permettent pas de déterminer le parcours d'une commande.
Les anciens résultats redirectUrl pointent aussi vers 5174 pour des tentatives
communes : ce champ n'est donc pas une preuve fiable de provenance.

## Matrice de compatibilité

| Commande/tentative/session | Accès et destination | Résultat attendu |
| --- | --- | --- |
| Tentative historique sans association commune | Grant historique/approbation sur 5174 | Pas de transfert automatique du token Store |
| Ancien pending opaque, clé/token absents | Assistance/récupération vérifiée | Blocage, aucune nouvelle commande |
| Commande avant les réservations, impayée | Autorisation valide requise côté client ; revue réservation backend | /pay bloque LEGACY_RESERVATION_REVIEW |
| Commande sans grant valide | Pas de GET/pay/confirm anonyme côté clients adaptés | Blocage ; orderId seul ne suffit pas |
| Tentative commune C/D déjà publiée sans nouveau marqueur | Association exacte déjà présente, GET scoped | Reprise conservée sans migration du stockage |
| Nouvelle tentative commune locale | Marqueur common sauvegardé avant création ; association exacte | Checkout /checkout/ ; même clé/body/token |
| Session historique active, domaine ancien ou 5174 | Request Stripe historique persistée ; Checkout historique | Ne pas remplacer pour changer le retour |
| Session commune active | Retour 5173/checkout/order-confirmation | Même session sur reload/timeout/double clic |
| Session du parcours opposé | STAGING_RETURN_CONFLICT | Reprendre son parcours d'origine, aucun remplacement |
| Commande PAID et session connue | Confirmation scoped + lecture backend EUR/PAID | Pas de /pay neuf ; finalisation idempotente |
| Session expirée, réservation expirée ou incertaine | Blocage/revue explicite selon règles existantes | Ne pas créer un ordre neuf pour contourner |
| Grant absent, expiré, révoqué ou d'un autre ordre | Refus client/backend si credential fourni | Stockage et tentative conservés |

Attention : le backend reste en mode compatible. Les anciens endpoints invités
peuvent encore répondre anonymement si le credential est omis. La propriété
« aucun accès avec un orderId seul » est imposée par les clients adaptés, mais
n'est pas encore une garantie globale du serveur. Ce blocage de confidentialité
ne peut pas être supprimé dans cette phase sans activer la protection coordonnée.
Le Checkout réellement déployé à 6b9c8b9 n'est pas le worktree adapté et reste
dépendant de ce mode compatible. Aucun durcissement immédiat n'est activé.

## Diagnostic des observations navigateur

1. PAID 9,90 EUR : cohérent avec les données du cluster et la finalisation
   simulée de phase D. Ce constat utilisateur n'est pas un test automatisé UI.
2. PENDING 11 EUR : absent du snapshot actuel ; une commande à 11 EUR est PAID.
   Elle peut avoir été observée avant paiement, dans un autre onglet/cluster ou
   un ancien rendu. L'absence actuelle ne permet pas de choisir entre ces causes.
   Les commandes à 9,90 et 11 EUR sont distinctes dans le snapshot.
3. Texte de préversion : défaut confirmé. GET des modules sur 5173 et 5174 et
   lecture du fichier ont trouvé le texte résiduel de phase C malgré le bouton
   actif. Il a été retiré ; test de régression ajouté. Le premier diagnostic
   disant qu'il était déjà absent a été corrigé après vérification du module servi.
4. Panier vide / remise invalide : panier courant et demande sauvegardée sont
   distincts. Un succès sauvegardé maintient l'écran de reprise même si le panier
   a été vidé. Une preview courante peut échouer alors que le code/total figés
   appartiennent à un achat antérieur. La reprise n'envoie pas les valeurs du
   formulaire actuel. Message explicatif et test UI de reprise avec panier vide
   ajoutés. Le motif exact du refus de remise observé reste inconnu.
5. Panier Store : stockage local magic-city-drip-cart, distinct de checkout_cart
   en sessionStorage. Le Checkout ne vide pas directement le panier Store.
   Layout le vérifie au retour/focus avec le grant de l'ordre marqué. Le contrôle
   exige désormais aussi l'id exact de la réponse PAID. PENDING, refus 401,
   réponse d'un autre ordre ou réponse tardive conservent le panier.

Pour attribuer définitivement les écrans : recueillir URL/origine/chemin,
nom du run, moment et résultat du reload, statut HTTP/code machine et identifiants
publics remplacés par les mêmes alias A/B sur tous les écrans. Pour le panier,
indiquer seulement nombre d'articles, état de reprise et montant, sans formulaire
client. Ne pas transmettre HAR brut, token, headers sensibles ou copie des stockages.

## Corrections et tests ajoutés

Les nouvelles tentatives conservent checkoutMode common/historical comme
métadonnée locale, hors du body API et du fingerprint backend. Les tentatives
anciennes ne sont pas réécrites. Sans marqueur et sans association commune déjà
publiée, le Store reste sur l'appairage historique. Les associations C/D exactes
déjà publiées sont conservées ; aucune conversion sur la seule possession d'un id.

Tests nouveaux : route figée hors API, reprise historique sans transfert, reprise
des associations C/D, suppression du texte résiduel, panier vide avec ordre figé,
PENDING/401/PAID d'une autre commande sans suppression du panier. Les tests
existants couvrent double clic, requêtes concurrentes, reload, réponse perdue,
revocation/expiration, sessions incompatibles et finalisation unique.
Deux scénarios HTTP supplémentaires sont préparés : requêtes/clés/montants/devise
et retours historiques intacts après confirmation répétée ; inventaire synthétique
sans données personnelles. Ils ont tous deux réussi dans l’exécution finale des 28 scénarios.

## Validation finale et reprise

Le lanceur antérieur a été arrêté avec Ctrl+C par l’utilisateur. Les quatre
ports 4100, 4101, 5173 et 5174 ont été vérifiés libres avant exécution.
Prisma generate réussit ; aucun verrou ou processus résiduel n’a été forcé.

Commandes exécutées, dans cet ordre, toutes deux avec code de sortie 0 :

```powershell
node tools/staging/validate.cjs
node tools/staging/start.cjs --verify
```

375 tests applicatifs et ciblés, 28 scénarios HTTP PostgreSQL/Stripe simulé et
six contrôles de routage passent. Les anciennes sessions gardent clé, montant,
devise, request et retour historique. Les scénarios de réponse perdue et de
confirmation/webhook concurrents ne créent pas de doublon ni de consommation
supplémentaire de stock/remise. Les refus d’Origin:null, de credentials incorrects
et de session incompatible restent effectifs.

Le cluster de validation run-1791137482976 a été arrêté par le finally du lanceur
et conservé. Le cluster PostgreSQL de la suite backend est également arrêté et
conservé. Les quatre ports sont libres après validation. Le cluster utilisateur
run-1791132357910, tous les anciens clusters et les stockages navigateur sont
préservés ; ils n’ont pas été réinitialisés. Aucun code métier modifié lors de
cette dernière reprise de validation. Les résultats sont enregistrés dans
VALIDATION_RESULTS.json, STAGING_RESULTS.json, COMMON_ORIGIN_RESULTS.json et
PHASE_E_RESULTS.json, sans credentials. COMPATIBILITY_INVENTORY.json contient
l’inventaire agrégé du nouveau cluster de test, distinct du snapshot utilisateur.

Puis reprise explicite d'un cluster conservé, sans reset, si les ports sont libres :

```powershell
node tools/staging/start.cjs --resume=run-1791129250212 --verify
```

Cette reprise rejoue les claims déjà connus et compare les compteurs. Pour
retourner au staging utilisateur, préférer son cluster run-1791132357910 :

```powershell
node tools/staging/start.cjs --resume=run-1791132357910
```

Ne pas exécuter --verify de reprise sur un run manuel dépourvu du fichier privé
de fixtures du harness. Ne pas vider les stockages pour faire réussir un scénario.

## Anomalies par gravité

- Ancien blocage de validation résolu : Prisma generate et les 28 scénarios
  passent. PASS automatisé de phase E ; ce résultat n’autorise pas la production.
- Bloquant production : accès invités anonymes encore possible en mode compatible,
  récupération vérifiée réelle indisponible, parcours navigateur automatisé/mobile
  non validé. L'observation UI de l'utilisateur est utile mais ne couvre pas la matrice.
- Important, corrigé : reprise ancienne transférée automatiquement sans distinction
  de parcours ; suppression potentielle sur une réponse PAID d'un autre id.
- Important, restant : une nouvelle session réelle sur origine commune n'est pas
  préparée pour déploiement. En local, PaymentAttempt.request conserve les URLs
  historiques 5174 ; stagingReturnBase est une surcouche du simulateur. Ce harness
  ne démontre pas un protocole Stripe réel de redirection commune. Une future
  stratégie de destination pour les nouvelles tentatives demandera une conception
  et une autorisation distinctes ; ne pas modifier les requests existantes.
- Modéré, corrigé : texte de préversion contradictoire et explication de reprise
  insuffisante lorsque panier/formulaire courants diffèrent des données figées.
- Modéré, restant : attribution du PENDING 11 EUR, refus de remise observé,
  transitions inter-onglets et panier modifié entre deux achats à vérifier en UI.

## Transition et rollback proposés — non exécutés

1. Conserver simultanément endpoints du pont, clients historiques et routes de
   confirmation historiques. Inventorier sessions actives par destination persistée.
2. Préparer séparément un staging authentifié, synthétique, avec même domaine
   pour les deux applications et origines API explicitement autorisées. La
   configuration actuelle est DEV local seulement : ne pas supposer qu'un build
   de production --mode staging active le parcours commun.
3. Faire choisir une destination fixe autorisée pour les NOUVELLES tentatives
   de paiement sous une autorisation séparée ; préserver toutes les requests et
   URLs des anciennes sessions. Aucun rewrite de commande ou de session active.
4. Déployer les adaptations compatibles uniquement après autorisation ; tester
   ancien/common, retours Stripe, reload/fermeture, cas incertains, mobile, accès
   révoqués et conservation du panier. Ne pas supprimer le pont historique.
5. Activer la protection obligatoire uniquement après validation et autorisation
   distinctes, avec récupération vérifiée opérationnelle et résolution des
   anciens parcours sans credentials. Ne pas bloquer silencieusement un ancien retour.

Rollback : arrêter l'entrée de NOUVELLES tentatives communes, mais garder les
associations, endpoints, routes communes et historiques pour les tentatives déjà
publiées. Ne pas rediriger une session existante vers l'autre parcours. Une restauration
du Store ne doit pas transformer un timeout en nouvelle commande. Conserver grants,
requests, tables et idempotence, sans migration destructive. Ne pas revenir au
code antérieur incapable de relire les associations communes déjà émises.

Prérequis du staging réel : hébergement privé/contrôle d'accès et TLS ; base dédiée
sans copie de production ; migrations additives sur cette base uniquement ;
simulateur distinct sans appel Stripe ; origines/retours/CSP et cache explicites ;
logs/proxy/APM masquant les credentials ; CSP/XSS ; limites distribuées ; builds
et environnement identifiables ; tests desktop/mobile ; reprise des snapshots
synthétiques sans destruction ; récupération simulée puis décision séparée pour
email réel. Aucun staging distant créé dans cette phase.

## Fichiers modifiés dans cette phase

Store : src/lib/checkoutAttempt.ts, src/lib/commonCheckout.ts,
src/lib/paidOrderCheck.ts, src/pages/Cart.tsx,
tests/checkout-validation.test.tsx, tests/store-backend-integration.test.tsx.
Checkout : src/pages/CheckoutLanding.tsx uniquement.
Outillage : tools/staging/common-access-tests.cjs, scenario.cjs, validate.cjs,
common-origin-validation.cjs, compatibility-inventory.cjs (nouveau), README.md,
CHECKOUT_COMPATIBILITY_VALIDATION.md (nouveau), COMPATIBILITY_ACTIVE_INVENTORY.json
(nouveau), PHASE_E_RESULTS.json (nouveau), VALIDATION_RESULTS.json,
COMMON_BUILD_RESULTS.json, COMMON_ACCESS_PRODUCTION_RESULTS.json,
STAGING_RESULTS.json, COMMON_ORIGIN_RESULTS.json, COMPATIBILITY_INVENTORY.json
(nouveau résultat agrégé de la validation finale).

Aucun code backend/Admin modifié. Pas de migration Prisma, contrat API changé,
protocole d'autorisation/paiement modifié, suppression de donnée, cluster ou token.
Aucun commit, push, merge, changement de branche, paiement réel, email réel,
déploiement ou changement de production. Les artefacts benchmark sont restaurés.
La phase F et toute infrastructure distante attendent une nouvelle autorisation.
