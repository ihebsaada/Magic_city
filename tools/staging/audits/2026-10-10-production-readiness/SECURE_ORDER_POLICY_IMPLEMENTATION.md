# SecureOrderPolicy — implémentation locale, 10 octobre 2026

## Verdict

**GO pour revue de l'implémentation locale ; NO-GO pour déploiement ou démarrage production.** Le blocage `PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED` est conservé et son test passe. Aucun commit, index Git, push, déploiement, accès Render/production, opération Stripe LIVE/SumUp ou changement de permissions PUBLIC. Les modifications applicatives préexistantes des trois worktrees sont conservées ; aucun nouveau changement Store/Checkout dans cette passe. `docs/` reste intact.

## Comportement implémenté

`services/secureOrderPolicy.ts` centralise le refus : registre absent/version différente de 1 → `409 HISTORICAL_ORDER_READ_ONLY` ; erreur de lecture/table indisponible → `503 ORDER_POLICY_UNAVAILABLE`. Aucun fallback, inférence par date/numéro/email/session ni backfill. La présence du registre ne remplace jamais l'autorisation guest.

La transaction de création contient Order/OrderItem, registre version 1, réservations de stock/remise et liaison du grant préparé. Une erreur tardive annule l'ensemble, y compris les compteurs et l'idempotence. Les deux endpoints `/orders` et `/checkout/intent` exigent clé et token en production, même si l'application est construite explicitement en mode production dans un test. Le service exige aussi ces éléments lorsque DEPLOYMENT_ENV=production ; un paramètre false ne contourne pas ce mode. Replay conserve la réponse/commande ; conflits refusés ; la provenance est recontrôlée lors d'un replay.

Les guards couvrent bind/autorisation/révocation/récupération, création/approbation/redemption des deux handoffs, startPayment/finalisation/confirmation/mutations admin, création/consommation/libération de réservation et réconciliation. La lecture minimale refuse aussi les historiques, y compris dans l'ancien mode local compatible. Staging et production imposent l'accès guest obligatoire ; le constructeur local sans mode conserve son ancien comportement de test pour les commandes modernes. Les services internes ne constituent pas des endpoints d'autorisation.

Les lectures admin authentifiées restent disponibles ; PATCH/reserve-legacy/reconcile-reservation/revoke-access historiques refusent. Request recovery reste non énumérante côté HTTP (202 uniforme si transport disponible), sans challenge ni livraison historique. Redeem recontrôle avant création de grant. Aucun transport recovery réel n'est configuré ici.

Webhook : signature/raw body et mode test/live restent contrôlés. Une référence de commande historique dans l'événement signé est refusée avant lecture Stripe ; une référence de session déjà connue est également contrôlée avant réconciliation distante. La cible réelle issue de Stripe est contrôlée de nouveau sous verrou avant toute écriture. Une session inconnue peut nécessiter une lecture fournisseur pour identifier sa commande, mais ne permet aucune écriture historique. Événement historique : 409 explicite, aucun événement/finalisation/grant/réservation créé, aucun faux succès. Il n'est pas acquitté silencieusement ; une destination Stripe pourrait donc réessayer. La politique opérationnelle d'alerte et de traitement de ces retries reste à valider avant déploiement.

Shipping/prix/remises et moteur de paiement inchangés : 11 − 1,10 + 5 = 14,90 EUR/1490 cents, seuil gratuit à 200 avant remise, snapshots conservés, montants/devise/session/attempt et finalisation idempotente vérifiés.

## Migration

`20261010120000_add_secure_order_policy/migration.sql` : nouvelle table SecureOrderPolicy ; orderId TEXT PK et FK RESTRICT vers Order(id), policyVersion INTEGER NOT NULL DEFAULT 1 avec CHECK =1, createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP. Aucun INSERT/backfill/UPDATE/DELETE ni ALTER Order/OrderItem. Le PK fournit l'index unique ; PostgreSQL 18 expose aussi trois contraintes NOT NULL dans pg_constraint. Le schéma Prisma contient la relation optionnelle inverse sur Order, sans colonne nouvelle sur cette table.

17 migrations locales au total (neuf historiques, huit additives). Toutes appliquées avec succès sur PostgreSQL Docker **18.6**, exclusivement synthétique. Contraintes et historique terminé vérifiés. L'empreinte SHA-256 de l'ensemble Order/OrderItem historique est identique avant/après la nouvelle migration (`historical-before.log` / `historical-after.log`). Cela ne remplace pas un audit du schéma, des checksums et des données production réels.

## Fichiers applicatifs et tests de cette passe

Tous sous `Magic_city_backend_security/drip_backend/` :

- `prisma/schema.prisma` ; `prisma/migrations/20261010120000_add_secure_order_policy/migration.sql` (nouveau).
- `src/services/secureOrderPolicy.ts` (nouveau), `orderIdempotency.ts`, `guestOrderAccess.ts`, `orderHandoff.ts`, `navigationHandoff.ts`, `paymentService.ts`, `reservations.ts`, `legacyReservation.ts`, `reservationReconciliation.ts`.
- `src/app.ts`, `controllers/orderController.ts`, `controllers/guestOrderAccessController.ts`, `controllers/stripeWebhookController.ts`, `middlewares/guestOrderAccess.ts`, `routes/orderHandoffRoutes.ts`, `routes/navigationHandoffRoutes.ts`.
- `tests/secure-order-policy.integration.test.cjs` (nouveau), `runtime-production.test.cjs`, `contracts.test.cjs`, `idempotency.integration.test.cjs`, `payment.integration.test.cjs`, `reservations.integration.test.cjs`, `guest-access.integration.test.cjs`, `handoff.integration.test.cjs`, `navigation.integration.test.cjs`, `catalog.integration.test.cjs`, `run-postgres-tests.cjs`.

Les fichiers productionConfiguration/runtimeConfiguration/server/stripeClient et les modifications frontends antérieures restent présents ; ils n'ont pas été réécrits par cette passe. Les fixtures modernes fabriquées directement dans les tests déclarent explicitement leur registre. Les tests positifs recovery utilisent désormais des commandes modernes ; ils ne récupèrent plus des historiques. Le test d'adoption historique devient un refus, et le catalogue attend le stock historique inchangé à 999. Les nettoyages de fixtures sont exclusivement sur bases synthétiques et tiennent compte de la nouvelle FK. Les grants/challenges/pairings historiques artificiels du test négatif sont des fixtures adversariales locales, jamais des droits émis par l'application.

Rapport et runners/logs/builds de preuve : `tools/staging/audits/2026-10-10-production-readiness/secure-policy/`. Ces artefacts générés ne sont pas des candidats à ajouter aveuglément à un commit.

## Validation réelle

| Suite | Résultat |
| --- | --- |
| Backend sans DB/mock/HTTP loopback | 50 PASS |
| PostgreSQL : idempotence | 16 PASS |
| PostgreSQL : paiement | 30 PASS |
| PostgreSQL : réservations | 48 PASS |
| PostgreSQL : guest access | 42 PASS |
| PostgreSQL : pont manuel | 15 PASS |
| PostgreSQL : navigation | 13 PASS |
| PostgreSQL : catalogue | 39 PASS |
| PostgreSQL : nouvelle matrice SecureOrderPolicy | 18 PASS |
| Store | 118 PASS |
| Checkout | 92 PASS |
| Cross-app VM | 20 PASS |
| Total, sans compter une deuxième exécution de navigation | **501 PASS** |
| TypeScript/build Backend, TS app/node/tests et builds frontends | PASS |
| Prisma generate/validate | PASS |
| Git diff et cached diff checks, trois worktrees | PASS |

Nouveaux tests : historiques avec ou sans grant artificiel, challenge/pairing artificiels, admin read/write, webhook LIVE/TEST signé simulé, absence réelle de table, version invalide, contraintes/FK, transaction annulée après réservations, concurrence même clé et clés distinctes avec même grant, recovery moderne, handoff concurrent, finalisation/webhook double et exact montant.

Les premiers passages ont révélé un garde de lecture minimale manquant (corrigé), un ordre de contrôle handoff qui changeait le refus hors scope (corrigé), des fixtures/mocks anciens à adapter, un JWT de test incomplet et les contraintes NOT NULL supplémentaires de PostgreSQL 18 à intégrer à l'assertion. Les résultats finaux ci-dessus ne masquent pas ces passages intermédiaires. `VALIDATION.json` conserve le premier échec mock ; `backend-tests-final.log` et `FINAL_VALIDATION.json` sont les preuves finales sans DB. Les fichiers regression-*.log et policy-tests.log contiennent les derniers résultats PostgreSQL.

Exécution Docker depuis Magic_city_git (runners à relire, ils appliquent les migrations UNIQUEMENT à leurs nouveaux clusters synthétiques) :

```powershell
node tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-regression-pg18.cjs
node tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-pg18.cjs
```

Docker est épinglé au daemon local Windows. Base lot4_isolated, port publié uniquement sur 127.0.0.1, environnement enfant nettoyé, Stripe remplacé par fake, données fictives. Aucun secret de production hérité. Chaque conteneur propre au runner est arrêté dans finally ; aucun ancien cluster/processus utilisateur touché. Stockage tmpfs temporaire : les conteneurs arrêtés restent listés, mais leurs données ne sont pas une archive restaurable. Les anciens runners PostgreSQL 17 et benchmark ne sont pas exécutés ; le runner 17 est seulement adapté pour exclure la nouvelle migration du baseline historique.

## Risques et prochaines conditions

1. Toute commande antérieure sans registre, y compris une tentative staging sécurisée créée avant cette migration, sera désormais non admissible. Aucun backfill automatique n'est prévu. Ne pas déployer sur un staging contenant des parcours encore à reprendre sans décision explicite de transition ; conserver leurs états.
2. Production : inventaire exhaustif, preuves Stripe LIVE/TEST et SumUp, callbacks actifs et obligations clients restent non vérifiés. La déclaration propriétaire est conservée, sans la transformer en preuve fournisseur.
3. Audit des 17 migrations locales contre l'historique production, collisions/contraintes/stock réel, sauvegarde et restore isolé restent nécessaires sous autorisations distinctes. Aucun changement PUBLIC autorisé ni effectué.
4. Assistance vérifiée pour les nouveaux clients, limites distribuées, surveillance des refus webhook, Linux et navigateur réel restent à valider. Les tests VM/HTTP synthétiques ne sont pas une validation Stripe ou navigateur réelle.
5. Les anciennes versions backend ne connaissent pas le registre : après activation, rollback uniquement vers une version qui préserve les guards et les objets. Ne pas supprimer table/registre/grants/tickets pour revenir en arrière.
6. Retrait du blocage production uniquement dans une phase ultérieure explicitement autorisée après validation humaine des conditions. Aucun bypass environnement ajouté.

```text
SECURE_ORDER_POLICY_IMPLEMENTED=YES
LOCAL_POSTGRES_VERSION=18.6
ADDITIVE_MIGRATION_LOCAL_PASS=YES
HISTORICAL_ORDER_ITEM_SNAPSHOTS_UNCHANGED=PASS_SYNTHETIC
LOCAL_TESTS=501_PASS
STARTUP_BLOCKER_REMOVED=NO
PRODUCTION_DB_ACCESSED=NO
PUBLIC_PERMISSIONS_CHANGED=NO
READY_FOR_LOCAL_IMPLEMENTATION_REVIEW=YES
READY_FOR_REMOTE_STAGING_DEPLOY=NO
READY_FOR_PRODUCTION=NO
```
