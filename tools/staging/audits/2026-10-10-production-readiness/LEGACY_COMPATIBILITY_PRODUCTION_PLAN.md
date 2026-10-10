# Commandes historiques et nouvelles commandes — revue du 10 octobre 2026

## Décision et verdict

Le propriétaire confirme qu'aucune transaction client réelle n'a eu lieu et autorise la conservation des commandes historiques dans l'administration. Cette décision permet de concevoir leur maintien en lecture administrative, sans récupération client historique. Elle ne constitue pas une vérification Stripe/SumUp ni un inventaire exhaustif de la base.

**GO pour revue du plan ; NO-GO pour démarrage/déploiement.** `requireProductionLegacyReadiness()` et son erreur `PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED` restent inchangés. Aucun nouveau code applicatif ni SQL n'est produit dans cette passe : la frontière décrite ci-dessous doit être validée avant son implémentation. Les modifications de remediation précédentes restent présentes, non commitées. Aucun accès production, migration, opération Stripe/SumUp, changement PUBLIC ou environnement distant.

## Frontière proposée, sans réécriture historique

Ne pas utiliser les numéros #1–#12, une date, l'email, le statut PAID, un identifiant Stripe, ou simplement l'existence d'un grant comme preuve de provenance. Ne pas supposer que l'administration montre toutes les commandes.

Proposition à valider : un registre serveur additif `SecureOrderPolicy`, une ligne uniquement pour chaque NOUVELLE commande créée par le protocole sécurisé après activation. Champs proposés : `orderId TEXT PRIMARY KEY REFERENCES Order(id) ON DELETE RESTRICT`, `policyVersion INTEGER NOT NULL CHECK (policyVersion=1)`, `createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`. Aucun backfill, aucun INSERT SELECT depuis Order, aucune modification de Order/OrderItem. Les noms sont une proposition de schéma, pas des objets existants.

Une commande sans registre est historique/non admissible au commerce guest ; une commande avec registre est admissible, mais exige TOUJOURS un grant actif exact-order et les contrôles de réservation/paiement existants. Le registre ne fournit aucun droit d'accès en lui-même. Une table absente ou une lecture en erreur doit bloquer, jamais traiter l'erreur comme une autorisation. Garder les registres après expiration de la fenêtre d'idempotence, révocation des grants ou paiement.

Pourquoi un registre séparé : `OrderIdempotency` a un rôle de replay, et la création actuelle autorise l'absence de clé. Une future purge de replay ne doit pas reclasser des commandes ; un grant récupéré ne doit pas devenir sa propre preuve d'admissibilité. Réutiliser ce modèle exigerait des changements de contrat et de rétention équivalents, moins explicites. Ne pas créer la migration du registre avant approbation du plan.

Création production : exiger clé d'idempotence valide et grant préparé ; créer Order, OrderItem, registre, réservations et liaison du grant dans UNE transaction. Aucune réponse commerciale publiée avant commit. Replay renvoie la même commande et les mêmes montants ; une clé conflictuelle refuse. Un échec annule aussi le registre et la liaison. Le bind initial est permis uniquement pour l'identifiant créé dans cette transaction, jamais pour un identifiant fourni par le navigateur.

## Chemins à fermer avant levée du blocage

| Source existante | Changement nécessaire, non implémenté ici |
| --- | --- |
| `services/orderIdempotency.ts`, `routes/orderRoutes.ts` | Registre atomique et clé obligatoire en production ; préserver replay/fingerprint/stock/remise/shipping |
| `services/guestOrderAccess.ts`, middleware guest | Vérifier admissibilité avant lecture autorisée, bind hors création et récupération. Historique : aucune émission de grant/challenge ni livraison ; réponse de récupération non énumérante. Redemption vérifie de nouveau avant toute écriture |
| `services/orderHandoff.ts`, `services/navigationHandoff.ts` | Vérifier registre source/destinataire pour création, autorisation et redemption ; aucune promotion implicite d'une commande historique |
| `services/paymentService.ts` | Refuser historique avant création/récupération Stripe et avant toute finalisation/écriture ; conserver amount/currency/attempt/session/mode exacts |
| `controllers/stripeWebhookController.ts` | Signature et mode LIVE restent obligatoires. Événement historique identifié : aucune modification Order/OrderItem, grant, réservation ou finalisation ; traitement explicite documenté, alerte expurgée. Toute preuve de paiement réel inattendue bloque le lancement et requiert revue humaine, sans faux succès |
| `services/legacyReservation.ts`, `services/reservationReconciliation.ts` | Désactiver l'adoption/reservation des historiques en production ; aucune fabrication de réservation pour passer le garde de paiement. Préserver le staging existant |
| `services/paymentService.ts:updateOrderState`, routes admin | Historiques lisibles par admin authentifié, mutations refusées côté serveur ; ne pas compter sur un bouton masqué. Inventorier aussi scripts opérateur/imports/jobs avant lancement |
| `productionConfiguration.ts`, `server.ts` | Retirer le stop uniquement dans une modification ultérieure revue, après toutes les conditions ci-dessous ; aucun toggle de contournement |

Attention concrète : aujourd'hui `requestGuestRecovery` accepte un email correspondant sans vérifier une provenance sécurisée ; si un adaptateur était branché, cela pourrait créer un challenge historique. `redeemGuestRecovery` peut créer un grant lié. `reserveLegacyOrder` peut créer une réservation historique via une action admin. `updateOrderState` permet des mutations admin et la réconciliation peut écrire des dépendances historiques. L'absence actuelle d'adaptateur recovery n'est pas une politique durable. Le blocage empêche actuellement le démarrage production de cette implémentation partielle.

La récupération des commandes historiques de test n'est donc pas requise après validation exhaustive de la classification et des obligations de callback. Pour les NOUVEAUX clients, une assistance vérifiée reste nécessaire : transport/UX de récupération validés ou procédure opérateur explicite et vérifiable. Aucune récupération par orderId/email/session seuls ; aucune promesse de service inexistant. Ne pas activer un adaptateur non revu.

## Migrations et schéma réellement observé

Observation fournie : PostgreSQL 18, dix tables historiques dont Order(id text), Variant, Discount, ProductImage et _prisma_migrations. Historique des migrations/checksums production et définitions complètes des colonnes/contraintes/index NON vérifiés dans cette passe.

16 dossiers locaux : neuf historiques et sept ajouts, dans cet ordre :

1. `20261003120000_add_order_idempotency` : OrderIdempotency, index unique orderId, FK Order(id).
2. `20261004120000_add_payment_attempts` : PaymentAttempt, PaymentFinalization, StripeEvent ; PK/uniques/checks et FK Order.
3. `20261004160000_add_stock_reservations` : Variant.reservedQuantity et Discount.reservedUses, défaut 0 ; deux CHECK NOT VALID ; OrderReservation et StockReservationItem, index/FK/checks.
4. `20261004190000_add_guest_order_access` : GuestOrderAccess, GuestOrderRecovery, index et FK Order.
5. `20261004210000_product_read_indexes` : index Variant(productId,id), ProductImage(productId,position,id).
6. `20261004230000_add_order_handoff` : OrderHandoff, unique recipientHash, FK GuestOrderAccess, index expectedOrderId/createdAt.
7. `20261005120000_add_navigation_handoff` : NavigationHandoff, trois FK Order/GuestOrderAccess, unique creationKeyHash et index orderId/createdAt.

Analyse SQL : additive, aucune instruction UPDATE/DELETE ni modification de Order/OrderItem dans ces sept migrations. Les colonnes ajoutées initialisent toutefois un état sur Variant/Discount ; les ALTER/CREATE INDEX prennent des verrous. NOT VALID évite de valider les anciennes lignes immédiatement, mais impose les checks aux futures écritures ; ce n'est pas une preuve de cohérence du stock existant.

Compatibilité partiellement établie : Order.id text correspond aux nouvelles FK text, tables parentes observées présentes. Restent à vérifier en lecture seule : PK/uniques réels, types Variant.id/productId/inventoryQuantity et Discount.id/usageCount/usageLimit, ProductImage.position/id/productId, enums historiques, compteurs négatifs, collisions d'objets, historique/checksums, privilèges et dérive globale. Ne pas affirmer que seules sept migrations sont pending sans résultats distants. Plan ultérieur : sauvegarde validée/restore isolé, audit exhaustif, autorisation distincte, déploiement des ajouts existants puis registre approuvé, audit post-migration. Aucune exécution ici.

## Matrice de tests à ajouter après validation du plan

- Historique sans registre : lecture/pay/confirmation refusés même avec un grant artificiellement présent ; récupération request/redeem ne crée aucun droit, n'envoie rien ; handoffs refusés.
- Historique : webhook signé LIVE/TEST, retour ancien, admin PATCH/reserve/reconcile ne modifient aucune ancienne ligne ni n'ajoutent de droit. Distinguer événement inconnu d'une commande moderne. Vérifier la politique d'acquittement Stripe avant déploiement.
- Nouveau : création atomique registre/grant/réservation ; rollback à chaque étape ; clé absente/conflit refusés ; double clic et réponse perdue récupèrent la même commande.
- Nouveau : grant expiré/révoqué/autre commande, ticket rejoué/concurrent, recovery challenge expiré/autre ordre refusés ; absence/erreur du registre échoue fermée.
- Nouveau : prix serveur, 5 EUR sous 200 avant remise et 0 à partir de 200 ; Stripe exact cents/devise ; webhook double/désordonné et confirmation scoped ; snapshot historique strictement inchangé.
- Régression staging, production MODE, CORS/origines, retour Store, panier fingerprint/revision, aucune boucle de vérification. Tests PostgreSQL isolés de concurrence indispensables ultérieurement ; aucun test DB production.

Ces nouveaux invariants sont un plan de tests, PAS des PASS revendiqués. Les suites existantes relancées vérifient les protections actuelles, pas un registre encore non implémenté.

## Vérifications minimales fournisseur, manuelles et lecture seule

Stripe : vérifier compte exact et modes LIVE ET TEST, toutes les périodes historiques ; rechercher sessions/intents/charges avec et sans metadata/order connu (y compris opérations non reliées en DB). Relever uniquement alias de commande, mode, état, montant/devise, succès, remboursement/dispute et sessions ouvertes/asynchrones. Comparer chaque référence Stripe présente en DB ; une référence absente n'exclut pas une réponse perdue. Examiner événements/webhooks en attente et destinations existantes. Aucun paiement, replay, expiration ou changement de configuration.

SumUp : vérifier compte marchand exact, transactions/checkouts/payment IDs référencés et historique complet non relié ; états pending/success/refunded/failed, montants/devises, remboursements/litiges et règlements. Une colonne SumUp vide ne prouve pas l'absence de transaction. Aucun débit/remboursement ni modification. Documenter périmètre temporel, compte et conclusion sans identifiants complets ni PII.

Si paiement réel ou obligation active découvert : STOP, réconciliation/récupération spécifique nécessaire. La déclaration du propriétaire est consignée, jamais remplacée par une inférence depuis le nombre 12.

## Conditions cumulatives de levée du blocage

1. Validation humaine du présent modèle admin-only et du registre, des obligations de callback et de l'assistance des nouveaux clients.
2. Inventaire DB exhaustif + comparaison admin + preuves Stripe/SumUp ; aucun client historique à servir ni paiement réel non résolu.
3. Implémentation des guards et de l'atomicité, tests ci-dessus et revue indépendante, staging non régressé.
4. Schéma/historique/checksums audités, sauvegarde/restore vérifiés, migrations autorisées séparément et audit post-migration PASS.
5. Configuration production/origines/LIVE/privacy/limites distribuées et exploitation validées ; Linux/browser final-flow.
6. Modification explicite revue pour retirer le stop. Ne jamais activer DEPLOYMENT_ENV=staging en production ni revenir au backend historique non protégé.

PUBLIC PostgreSQL reste inchangé. Si le rôle d'audit strict refuse PUBLIC TEMP, utiliser une stratégie de revue approuvée (par exemple copie isolée) ; aucune correction globale automatique. Les tests Docker précédents 30/30 restent une preuve de simulation, pas un audit production.

## Validation locale de cette revue

Résultats réels dans `legacy-compatibility/RESULTS.json` et logs : Backend 49, Store 118, Checkout 92, cross-app 20, soit **279 PASS, zéro échec**. TypeScript Backend et configurations app/node/tests des frontends PASS ; trois builds PASS ; Prisma validate PASS. Git diff --check et diff --cached --check PASS dans les trois worktrees ; branches staging/store, staging/backend et staging/checkout confirmées. Aucun staging Git effectué.

Environnement des processus nettoyé, credentials exclusivement synthétiques, URL DB loopback port 1 jamais contactée. Tests backend non-DB/mock et serveurs HTTP loopback uniquement ; pas de runner PostgreSQL/migrations, pas de navigateur ni de Stripe réel. Builds frontend isolés dans le dossier de preuves. Les avertissements React SSR/router et Git LF/CRLF ne sont pas des échecs de tests. Aucun fichier applicatif modifié par cette revue ; seuls ce plan et les preuves locales sont ajoutés. `docs/` préexistant préservé.

```text
OWNER_NO_REAL_CUSTOMER_TRANSACTIONS=CONFIRMED_BY_OWNER
PROVIDER_ABSENCE_OF_REAL_PAYMENTS=UNVERIFIED
HISTORICAL_RECORDS_CHANGED=NO
HISTORICAL_GRANTS_CREATED=NO
PROPOSED_SEPARATION_IMPLEMENTED=NO
STARTUP_BLOCKER_REMOVED=NO
LOCAL_TESTS=279_PASS
PRODUCTION_SCHEMA_FULLY_VERIFIED=NO
READY_FOR_IMPLEMENTATION_REVIEW=YES
READY_FOR_PRODUCTION_STARTUP=NO
PRODUCTION_GO_NO_GO=NO_GO
```
