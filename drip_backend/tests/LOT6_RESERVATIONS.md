
# Lot 6 — réservations de stock et remises limitées

Validation locale du 4 octobre 2026. Worktree Magic_city_backend_security,
branche fix/backend-order-privacy, HEAD d6107db9221ab746867639c4b99f8c6b2ee8397e.
Les lots 1 à 5 sont conservés et leurs suites sont réexécutées.
Aucun commit, push, merge, déploiement, paiement réel, accès à la base de production
ou changement de variables de production. Aucun fichier du Store, de l'Admin ou
du Checkout n'est modifié. Les frais de livraison restent inactifs.
Aucune tâche d'expiration, purge ou réconciliation n'est planifiée.

## Rapport PASS/FAIL

| Contrôle | Résultat |
| --- | --- |
| TypeScript — npm run typecheck | PASS |
| Build — npm run build, exécuté par les suites | PASS |
| Prisma validate avec URL synthétique locale | PASS |
| Tests synthétiques et contrats — npm test | PASS, 29/29 |
| PostgreSQL, idempotence commandes lot 4 | PASS, 16/16 |
| PostgreSQL, sessions et paiements lot 5 | PASS, 30/30 |
| PostgreSQL, stock/remises lot 6 | PASS, 48/48 |
| Migration sur historique synthétique | PASS |
| Paiements Stripe réels et production | NON EXÉCUTÉS |

Total : 123 tests passent, aucune erreur finale de test.
Les exceptions PostgreSQL P0001 affichées pendant les simulations sont injectées
volontairement par des triggers pour vérifier les rollbacks. Elles ne constituent
pas des échecs de test.

Les premiers passages ont détecté puis corrigé :
- La réponse Stripe idempotente de création pouvait être un snapshot ancien :
  récupération suivie d'une lecture actuelle de la session.
- La réponse répétée de réservation historique omettait les lignes : elle retourne
  désormais le même ensemble de champs.
- Fixtures historiques ambiguës : SKU synthétique explicite ajouté, plutôt
  qu'assouplir la validation des variantes.
- Absence de no-store sur la prévisualisation dynamique des remises : corrigée.

## Environnement de validation

PostgreSQL 17 réel, cluster nouvellement initialisé à chaque exécution, écoute
127.0.0.1 et port aléatoire, rôle/base dédiés aux tests. Les seules variables
transmises sont les chemins système et des valeurs synthétiques explicitement
construites par le runner. Aucun dotenv de production n'est chargé.

Migrations historiques appliquées d'abord, commande et variantes synthétiques
créées avant les migrations additives, puis migrations des lots 4, 5 et 6.
La commande historique a un total 12,34 et une ligne au même prix alors que
la variante actuelle coûte 20 : la réservation historique ne recalcule rien.
Les variantes historiques ont les stocks 999, null et 0.
Les suites tournent séquentiellement. Tous les clusters lancés ont été arrêtés
par le runner en finally ; leurs fichiers ignorés sont conservés pour inspection.

Stripe est remplacé avant l'import Express. Aucun appel au réseau Stripe.
Le SDK réel sert uniquement aux signatures et vérifications locales des webhooks
synthétiques. Les tests utilisent HTTP sur un serveur Express local.

## Modèle et invariants

inventoryQuantity reste le stock physique total de la variante.
reservedQuantity est la quantité engagée par des réservations ACTIVE, y compris
celles dont le paiement est incertain.
Disponibilité = max(0, stock physique - réservations).
Le DTO public garde son champ stock et soustrait les réservations. Produits et
collections utilisent la somme des disponibilités de toutes les variantes.
Le contrôle final porte toujours sur la variante exacte, pas ce stock agrégé.

OrderReservation est unique par commande : ACTIVE, CONSUMED ou RELEASED.
StockReservationItem est unique par couple commande/variante et mémorise
la quantité agrégée. Les lignes de commande originales restent inchangées.
Les quantités identiques sont agrégées par identifiant réel de variante, même
si des sélections différentes désignent la même variante. Limite 99 par variante,
100 lignes entrantes et 1 000 unités par nouvelle commande.

La création, ses prix, les réservations de stock/remise, la clé d'idempotence et
sa réponse sont dans la même transaction, avec ou sans en-tête facultatif.
Ordre de verrouillage : produits triés, variantes triées, remise.
Les consommations/libérations verrouillent la commande, les variantes triées,
puis la remise. Aucune opération Stripe n'est faite dans une transaction SQL.
Les verrous de produits protègent aussi contre les changements de variantes
par l'Admin pendant la sélection et le calcul de prix.

Au paiement, dans la transaction du lot 5 :
- stock physique et reservedQuantity diminuent ensemble ;
- reservedUses diminue et usageCount augmente ensemble ;
- réservation CONSUMED, paiement, remise et finalisation sont atomiques.
Ainsi payer ne remet pas une unité vendue à disposition.
Répétitions, événements désordonnés et déclaration Admin répétée ne consomment
pas une deuxième fois.

La libération diminue seulement les réservations, pas le stock physique ni
usageCount. La commande devient CANCELLED et la réservation RELEASED.
Les paiements déjà confirmés et les réservations CONSUMED ne sont jamais libérés.
Un remboursement ou une annulation après paiement ne réapprovisionne pas
automatiquement les unités : le retour physique est une décision distincte.

## Politique explicite des stocks

- Produit sans variante : refus, comme au lot 3.
- Variante absente, ambiguë ou option3 non prise en charge : refus sans fallback.
- inventoryQuantity null : indisponible, pas illimité.
- Stock 0 : indisponible.
- Stock négatif : indisponible ; aucune correction automatique de données.
- Ancien défaut 999 : quantité finie de 999 unités, jamais un indicateur illimité.
- Les stocks historiques, dont 999/null/0, ne sont pas réécrits par la migration.
- Le défaut Prisma historique 999 est conservé pour respecter la migration
  additive. Les créations Admin sans stock explicite démarrent désormais à 0.
  Les scripts d'import existants doivent fournir des inventaires vérifiés ;
  aucun script d'import/reset n'a été exécuté ou modifié.

## Durée et paiement

Une nouvelle réservation expire une heure après la création de la commande.
Cette date est persistante. La création Stripe envoie expires_at exactement
à cette échéance, en secondes ; la demande et la clé restent celles du lot 5.

La première session, ou une nouvelle génération après expiration, doit être
initialisée lorsqu'il reste au moins 30 minutes plus 5 secondes de marge.
Une session déjà créée peut être réutilisée tant que la réservation n'est pas
expirée et que Stripe la confirme ouverte.
Une tentative non résolue conserve sa clé, même si sa reprise échoue.

Cette fenêtre respecte la contrainte Stripe de 30 minutes à 24 heures :
https://docs.stripe.com/api/checkout/sessions/create

L'échéance rend une réservation éligible à libération ; elle ne prouve pas
l'absence de paiement. Après l'heure limite :
- Sans tentative : la réconciliation explicite peut libérer.
- Session ouverte : expiration Stripe demandée et vérifiée avant libération.
- Session expirée réellement impayée : libération transactionnelle.
- Session réellement payée : finalisation transactionnelle, sans libération.
- Session complète impayée, timeout, incohérence ou résultat inconnu :
  conservation des engagements et reconciliationReason.
- Résultat de création perdu : reprise avec la demande et la clé originales,
  puis lecture actuelle de la session.
- Tentative inconnue âgée de 23 heures : pas de nouvelle création aveugle,
  revue manuelle requise.

Stripe interdit de compléter une session expirée :
https://docs.stripe.com/api/checkout/sessions/expire
Les anciennes réponses de création mises en cache ne sont pas utilisées comme
preuve d'état actuel.

Déclencheurs existants : annulation Admin explicite et webhook d'expiration
valide. Une action Admin permet aussi une réconciliation ciblée. Aucun cron,
batch automatique, timer d'expiration ou tâche de purge n'est ajouté.
Un panier abandonné sans tentative ni action ultérieure peut donc rester
réservé après l'échéance jusqu'à une intervention manuelle.

## Remises

Toutes les remises appliquées ont un engagement lié à leur identifiant réel ;
cela permet de passer ultérieurement un code illimité à une limite sûre.
Pour une limite, usageCount + reservedUses ne peut pas dépasser usageLimit.
La prévisualisation tient compte des usages réservés mais ne réserve rien.
Une concurrence peut donc faire perdre la dernière place entre preview et
création : réponse 409 DISCOUNT_UNAVAILABLE, sans créer de commande ni relever
silencieusement le prix à payer.

Le prix/remise de la commande demeure le snapshot calculé au lot 3.
Une désactivation, expiration ou modification ultérieure de valeur n'altère
pas une remise déjà réservée. La consommation honore cette réservation.
Une remise utilisée dans l'historique des réservations ne peut pas être supprimée.
L'Admin ne peut pas abaisser sa limite sous les consommations + engagements.

## Protection Admin

L'endpoint default-variant conserve sa forme. Sans variantId il vise la première
variante par id, comme variante par défaut ; variantId facultatif permet un
ciblage exact d'une autre variante du même produit.
Le stock entré est physique, pas disponible : réduction sous les réservations
actives refusée par 409 STOCK_BELOW_RESERVATIONS.
Stocks négatifs, fractionnaires et valeurs mal formées refusés par 400.
null signifie indisponible et est refusé si des unités sont réservées.

Les suppressions de produits/remises ayant un historique de réservation
retournent 409, avec transactions évitant les suppressions partielles.
Désactiver/archiver reste préférable à supprimer ; aucun écran client modifié.

Une déclaration Admin PAID reste une opération de confiance conservée du lot 5.
Pour une commande gérée, elle consomme atomiquement stock et remise une seule fois.
Elle ne déclenche pas un paiement Stripe. REFUNDED ne déclenche pas de remboursement.

## Compatibilité historique : changement de comportement nécessaire

Aucun backfill, recalcul de commande, frais, prix ou compteur consommé.
Les commandes déjà PAID/SHIPPED/DELIVERED/REFUNDED conservent leurs états et
les protections du lot 5. Une confirmation historique déjà payée reste possible,
sans consommer rétrospectivement du stock ou incrémenter une remise.

Une commande ancienne PENDING sans réservation ne peut plus initialiser ou
finaliser automatiquement un paiement, ni être déclarée PAID sans réservation :
409 LEGACY_RESERVATION_REVIEW.
Sinon elle pourrait contourner la réservation de la dernière unité.
Un paiement Stripe historique déjà capturé mais non enregistré doit être
réconcilié ; il n'est pas transformé automatiquement en commande traitable.

Action Admin explicite ajoutée :
POST /api/admin/orders/:id/reserve-legacy
- authentification JWT existante obligatoire ;
- résolution des anciennes lignes par produit, SKU/options exacts ;
- refus si variante supprimée, ambiguë, quantité invalide, stock insuffisant,
  remise disparue ou limite indisponible ;
- aucun recalcul des prix, du total, de la livraison ou des lignes ;
- réservation d'une heure depuis cette validation opérateur ;
- répétition retourne la réservation existante, sans nouvelle prise de stock ;
- réservation RELEASED jamais réactivée ;
- avant usage réel, l'opérateur doit vérifier les paiements Stripe historiques
  et approuver l'ancien devis. Ce endpoint ne fait pas cet inventaire externe.

Les nouvelles commandes, /checkout/intent, /orders, /orders/:id/min,
/pay {orderId} -> {url,sessionId}, /pay/confirm et les mappings Admin gardent
leurs formes de succès existantes. De nouveaux conflits explicites préviennent
les paiements incompatibles avec les ressources disponibles.

## Procédure de réconciliation ciblée

Action ajoutée, JWT Admin obligatoire :
POST /api/admin/orders/:id/reconcile-reservation

1. Identifier la commande et lire sa réservation, ses lignes et ses tentatives.
   Lire aussi tous les états Stripe connus. Ne jamais interpréter l'échéance
   ou un timeout comme une preuve d'échec de paiement.
2. Pour une ancienne commande sans réservation, inventorier d'abord ses sessions
   historiques connues/inconnues, vérifier le devis et les variantes. Si valide,
   appeler reserve-legacy une fois ; cette action doit rester ciblée et auditée.
3. Pour une réservation ACTIVE expirée/annulée, appeler reconcile-reservation.
   Le service relit ou récupère les sessions et ne libère qu'après preuve qu'elles
   sont expirées et impayées. Une session payée passe par la finalisation commune.
4. En cas d'incertitude, conserver les réservations. Corriger l'accès réseau ou
   examiner Stripe puis reprendre la même action. Les clés ne sont pas purgées.
5. Commande annulée avec fonds capturés, session ancienne supersédée payée,
   variante inexistante ou stock insuffisant : décision opérateur nécessaire.
   Une déclaration PAID ne doit être utilisée qu'après preuve de paiement et
   présence d'une réservation valide ; un remboursement Stripe exige une phase
   autorisée distincte.
6. Comparer, en lecture seule, reservedQuantity à la somme des lignes ACTIVE
   par variante, et reservedUses aux réservations ACTIVE par remise. Examiner
   les divergences avant toute réparation. Ne pas réécrire les compteurs
   aveuglément ni diminuer les quantités d'une commande payée.
7. Commande SHIPPED/DELIVERED encore impayée : conserver le stock engagé et
   examiner FULFILLED_ORDER_PAYMENT_REVIEW. Ne pas libérer automatiquement.

Aucune de ces actions n'a été exécutée sur une commande de production.
Aucune tâche périodique n'est proposée ou programmée dans ce lot.

## Migration additive

prisma/migrations/20261004160000_add_stock_reservations/migration.sql :
- Variant.reservedQuantity, entier non nul, défaut 0.
- Discount.reservedUses, entier non nul, défaut 0.
- OrderReservation et StockReservationItem, clés uniques et références RESTRICT.
- Index pour variante et état/échéance.
- Quantités positives et <=99, états limités.
- Contraintes sur compteurs non négatifs, stock réservé <= COALESCE(stock,0),
  consommations + engagements <= limite lorsqu'elle existe.

Les contraintes ajoutées sur tables historiques sont NOT VALID pour éviter
de modifier ou bloquer la migration sur des incohérences anciennes inconnues.
Elles protègent les nouvelles insertions/mises à jour. Une vérification puis
validation des données historiques dans un staging autorisé reste nécessaire ;
aucune correction ni validation de contraintes n'a été lancée en production.
La migration a été réellement appliquée uniquement sur les clusters locaux.

## Couverture obligatoire PostgreSQL

| Scénario | Résultat |
| --- | --- |
| Deux commandes sur la dernière unité exacte | PASS |
| Plusieurs lignes et sélections désignant la même variante | PASS |
| Dernier usage d'une remise, sur produits indépendants | PASS |
| Paiement/expiration simultanés, deux ordres d'issue | PASS |
| Webhooks répétés/désordonnés | PASS |
| Admin stock pendant réservation, y compris concurrence | PASS |
| Timeout, réponse perdue, rollback et reprise avec même clé | PASS |
| Libération répétée et concurrente | PASS |
| Historique avant migration, sans recalcul | PASS |

Les 48 tests incluent aussi stocks null/0/999, DTO produits/collections,
contraintes SQL directes, compteurs de remise, suppressions Admin, déclarations
PAID, annulation, remboursement sans restock, échec d'expiration Stripe,
réponse de création ancienne, quota réutilisable après libération et
réservation historique explicite/idempotente.
Les fixtures financières du lot 5 ont une réservation synthétique vérifiée ;
le cas historique déjà payé reste testé sans réservation. Aucune attente de
résultat n'a été supprimée pour masquer une régression.

## Impacts clients à coordonner, non implémentés

- Store : conserver/réutiliser la clé de création du lot 4 ; afficher les conflits
  VARIANT_OUT_OF_STOCK / DISCOUNT_UNAVAILABLE, recharger prix/stock/preview sans
  renvoyer automatiquement une nouvelle commande ou accepter un prix augmenté.
  Le stock affiché reste global ; les options exactes ne sont pas exposées dans
  le DTO actuel. Le serveur reste l'arbitre final.
- Checkout : afficher la fenêtre de validité, distinguer expiration/revue
  historique, conserver orderId/sessionId et les reprises bornées du lot 5.
  Après échéance, attendre la réconciliation ; ne pas recréer une commande
  lorsque le paiement pourrait déjà être capturé.
- Admin : afficher physique/réservé/disponible, usages consommés/réservés,
  raisons de réconciliation et conflits 409. Prévoir des actions explicites
  reserve-legacy et reconcile-reservation, contrôlées et auditables.
  L'interface déployée peut recevoir une erreur générique en attendant cette
  adaptation ; le protocole de succès reste compatible.
- Les nouvelles dates ne sont pas ajoutées au DTO public minimal, afin de
  conserver son contrat exact. Une future évolution additive permettra leur
  affichage dans Checkout, après autorisation.

## Risques résiduels et conditions avant activation

- Sans tâche autorisée, les abandons sans événement Stripe demandent une action
  manuelle après échéance. Une panne peut conserver stock et quotas plus longtemps.
- Le POST de création reste public et la clé facultative. Deux clés peuvent créer
  deux réservations légitimes, et l'abus de réservations peut immobiliser le stock.
  Aucun contrôle de débit/client ou lot 7/8 n'est implémenté.
- Les anciennes sessions Stripe créées sans idempotence et jamais enregistrées
  doivent être inventoriées avant activation. Un lien Stripe déjà émis peut
  encore capter des fonds ; le backend bloque le traitement sans réservation.
- Stock réel des anciennes valeurs 999 et ventes historiques non décomptées :
  rapprochement manuel nécessaire ; le code ne peut pas vérifier cet inventaire.
- Aucun test contre un compte Stripe, aucune validation de sa configuration,
  aucun test de charge distribué ou panne physique. Les dates des fixtures sont
  modifiées pour simuler l'écoulement du temps.
- La sérialisation des créations d'un même produit peut ajouter de la contention ;
  il reste à la mesurer, pas à la présumer résolue.
- Les déclarations Admin de paiement et la validation du devis historique
  restent des actions de confiance ; leur audit détaillé n'est pas ajouté.
- Les scripts d'import/maintenance doivent respecter les nouveaux compteurs et
  contraintes. Ils n'ont pas été exécutés.
- Pas de suppression des historiques ni de restock automatique après remboursement.

## Fichiers concernés par le lot 6

Nouveaux :
- src/services/reservations.ts
- src/services/reservationReconciliation.ts
- src/services/adminInventory.ts
- src/services/legacyReservation.ts
- prisma/migrations/20261004160000_add_stock_reservations/migration.sql
- tests/reservations.integration.test.cjs
- tests/LOT6_RESERVATIONS.md

Modifiés :
- prisma/schema.prisma
- src/services/orderCreation.ts
- src/services/orderIdempotency.ts
- src/services/orderPricing.ts
- src/services/paymentService.ts
- src/controllers/orderController.ts
- src/controllers/stripeWebhookController.ts
- src/controllers/productController.ts
- src/controllers/collectionController.ts
- src/controllers/discountController.ts
- src/routes/orderRoutes.ts
- tests/contracts.test.cjs
- tests/idempotency.integration.test.cjs
- tests/payment.integration.test.cjs
- tests/run-postgres-tests.cjs

Les autres modifications visibles dans Git sont celles des lots précédents.

## Validation et rollback futurs

Dans un staging autorisé : appliquer la migration additive, régénérer Prisma,
tester les quatre versions clients et inventorier stocks, remises et commandes
historiques avant d'activer les ventes. La libération périodique nécessite
une autorisation séparée ; elle n'est pas programmée.

Ne pas revenir directement à un backend qui ignore les réservations pendant
qu'elles sont actives : il pourrait revendre le stock engagé.
Préférer un correctif ou un binaire compatible avec ces invariants.
Pour un rollback ancien autorisé, suspendre créations et initialisations de
paiement, réconcilier les engagements/fonds et conserver tables, compteurs et
clés. Aucun down migration, effacement d'historique ou rollback n'est exécuté.

Attendre une autorisation explicite avant toute autre phase.
