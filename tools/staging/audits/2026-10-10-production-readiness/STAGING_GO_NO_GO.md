# Staging release readiness — 10 octobre 2026

Mise à jour : les observations sur le webhook 409 et l'absence d'artefact sont
supplantées par `STAGING_BLOCKERS_RESOLUTION.md`. Ce rapport demeure une preuve
de la revue précédente ; aucun GO distant n'est accordé.

## Verdict : NO-GO distant ; GO pour revue locale

Aucun commit, staging Git, push, déploiement, modification distante, accès production, paiement Stripe ou changement PUBLIC. Le stop `PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED` reste présent. Les modifications applicatives existantes et `docs/` sont préservés. Aucun nouveau changement applicatif dans cette revue.

Branches vérifiées : Store `staging/store` @ `1faef44a5e7914bc6e338ba76073ac13658cd2fd`, Checkout `staging/checkout` @ `f3052ebd5ea1628d0a3977c069ce2817ed9b08ef`, Backend `staging/backend` @ `c05b8102c7b819febc0b95ed84fd59f346738b14`. Index vides. Ces HEAD ne contiennent pas les changements locaux examinés.

## Candidats et portée

Liste exhaustive des candidats applicatifs : `STAGING_COMMIT_CANDIDATES.md` (Store 3, Checkout 3, Backend 34). Les diffs concernent l'activation production explicite, les tests de mode, la configuration stricte, puis SecureOrderPolicy et ses guards/tests. Conserver ces changements ensemble : isoler uniquement la migration sans les guards laisserait une frontière incohérente.

Proposition de commits, à autoriser ultérieurement :

1. Backend : `feat(backend): enforce secure order policy without legacy backfill` — les 34 fichiers listés, y compris configuration production et tests. Le stop production demeure.
2. Checkout : `feat(checkout): support explicitly configured secure production handoff` — les 3 fichiers listés.
3. Store : `feat(store): support secure handoff and shipping in production mode` — les 3 fichiers listés.
4. Outillage séparé sur Store : `docs(staging): document secure policy release gates and local validation` — sélection explicite après revue : les rapports Markdown de ce dossier, scripts SQL de revue, `release-check.cjs`, les deux runners `secure-policy/run-*.cjs`, `pg18-simulation/run-postgres18.cjs` et `.gitignore`. Les SQL de création/révocation du rôle production sont des documents administratifs NON exécutables automatiquement ; les conserver seulement si leur destination documentaire est approuvée. Aucun `git add .`.

Exclure : `docs/` préexistant ; `.runtime/`, node_modules, dist, builds publics/isolés, logs, résultats JSON, inventaires générés, copies baseline/schema/migrations, captures et preuves temporaires, fichiers .env réels, dumps et secrets. Le nouveau `.gitignore` local au dossier d'audit exclut ses JSON/logs et dossiers générés identifiés, sans supprimer les fichiers ni ignorer les tests applicatifs ou migrations originales. Les runners réutilisables restent visibles. Le scan ciblé des 40 candidats applicatifs n'a pas trouvé de secret réel ; les URI `.invalid` et clés synthétiques des tests ont été distinguées. Ce scan ne certifie ni l'historique Git complet ni tous les fichiers binaires/documents.

## Migration et cohérence

17 migrations locales, dans l'ordre existant. `20261010120000_add_secure_order_policy` vient après NavigationHandoff. Elle crée seulement SecureOrderPolicy : orderId TEXT PK, FK vers Order(id) RESTRICT/CASCADE, policyVersion entier DEFAULT 1 CHECK =1, createdAt TIMESTAMP(3). Aucune écriture/backfill historique, aucun ALTER Order/OrderItem. Prisma expose la relation inverse optionnelle ; aucun champ de provenance navigateur n'est accepté comme autorité.

Création atomique : Order/OrderItem, registre, réservations stock/remise et bind du grant ; rollback intégral en cas d'échec. Production exige token préparé et clé d'idempotence. Replay contrôle aussi le registre ; conflit refusé. Absence/version invalide refuse 409 ; erreur de table/lecture refuse 503. Le registre ne remplace pas le grant exact-order actif. Admin read reste disponible ; commerce et mutations historiques refusent.

Compatibilité distante NON prouvée : migrations/checksums, contraintes/types/objets staging réels restent à inventorier. Ne pas supposer que seule cette migration est pending. Après autorisation distincte, toute migration serait précédée d'un backup validé et comparaison exacte des checksums/pending ; aucune commande de migration exécutée dans cette revue. Les anciens tests synthétiques attestent la conservation du hash Order/OrderItem, pas celle de données distantes non lues.

## Anciennes commandes staging : transition sans backfill

`PG_STAGING_URL` et `STAGING_DATABASE_HOST` sont absents du processus agent. Aucun inventaire distant exécuté ; nombre, états, tentatives/grants/réservations et callbacks actifs UNKNOWN. Le script préparé `STAGING_TRANSITION_READ_ONLY.sql` est psql, transaction REPEATABLE READ READ ONLY, garde stricte magiccity_db_staging, ROLLBACK final, sans PII ni références complètes de paiement. Tables absentes explicitement signalées ; erreurs de schéma interrompent le script. Une absence de registre signifie que TOUTES les commandes déjà existantes seront historiques, y compris les commandes staging précédemment sécurisées.

Procédure future, sous autorisation : valider localement URI PostgreSQL, pathname exactement `/magiccity_db_staging`, hostname égal à STAGING_DATABASE_HOST indépendamment vérifié, TLS ; refuser magiccitydb_3334 et toute identité production. Utiliser psql 18 `-X -w -v ON_ERROR_STOP=1 -f` avec le script, credentials uniquement via environnement enfant dédié, `PGOPTIONS=-c default_transaction_read_only=on`. Ne pas passer l'URL en arguments ou charger un .env ambigu. Ne pas lancer le SQL présentement.

Avant bascule, établir les dépendances par commande dans une revue privée expurgée et confronter Stripe TEST : sessions ouvertes, paiements asynchrones, événements non livrés, tentatives actives, réservations expirables et grants/tickets existants. Les comptes agrégés du script sont un premier diagnostic, PAS une preuve suffisante de clôture individuelle. Tout cs_live ou mode LIVE inattendu arrête la préparation.

Choix de transition à approuver : conserver toutes les anciennes lignes et dépendances inchangées, admin-only après activation. Aucun grant, réservation, registre ou récupération artificiel. Aucun recalcul des montants. Les tentatives historiques ne peuvent pas reprendre sous les nouveaux guards ; ne pas promettre le contraire. Si une obligation reste active, STOP avant bascule et faire valider un traitement isolé. Finaliser un ancien paiement modifierait son état : cela n'est pas autorisé par cette mission. Ne pas effacer les stockages clients pour simuler une reprise.

Prévoir une fenêtre de maintenance explicitement autorisée pour empêcher de nouvelles émissions pendant l'inventaire final/la bascule. Le flag frontend handoff n'est PAS un verrou global de création de commandes. Ne pas inventer une variable maintenance ni utiliser un backend ancien pour servir des commandes modernes après activation.

## Webhooks historiques : refus sûr, blocage opérationnel restant

Implémentation actuelle : signature/raw body, mode Stripe, référence metadata/session connue, puis policy sous verrou avant écriture. Historique → HTTP 409 HISTORICAL_ORDER_READ_ONLY ; aucune mutation Order/OrderItem, StripeEvent, finalisation, réservation ou grant. Une session inconnue peut nécessiter une lecture Stripe pour identifier l'ordre ; les guards restent obligatoires avant écriture.

**Un 409 ne constitue pas un acquittement et le backend actuel ne peut pas arrêter les retries fournisseur.** Il n'existe pas de quarantaine/alerte durable configurée ni politique de disposition terminale implémentée. Ne pas remplacer 409 par 200, ne pas marquer PAID et ne pas prétendre le problème résolu par le refus seul.

Avant release : revue des deliveries TEST historiques, décision opérateur sur leur retrait/isolation dans Stripe sous autorisation distincte ; ne jamais désactiver une destination partagée avec les commandes modernes. Prévoir alertes dédupliquées hors données commerciales : catégorie de refus, alias expurgé, compte agrégé, première/dernière occurrence et seuil d'escalade ; pas de body, signature, token, PII ou session complète dans logs/APM. Les alertes ne doivent pas créer une boucle ni modifier les commandes. Le transport/suivi et l'opérateur responsable restent à désigner.

Si l'arrêt sélectif des retries n'est pas possible opérationnellement, une réception en quarantaine durable et un accusé de transport explicitement distinct d'une exécution commerciale exigent une conception/autorisation/tests supplémentaires. Ce n'est pas implémenté, ni un succès de paiement. Maintenir NO-GO tant que les obligations historiques et cette politique ne sont pas validées. Aucune action Stripe réalisée ici.

## Compatibilité des clients

Store transmet clé Idempotency-Key stable et Order-Access-Token préparé depuis la tentative figée, conserve fingerprint/révision et reprend la même commande. API `VITE_API_URL`; destination `VITE_CHECKOUT_ORIGIN`; `VITE_NAVIGATION_HANDOFF_ENABLED=true`. Checkout consomme **VITE_PRIMARY_API_URL**, `VITE_STORE_ORIGIN`, basename `/`, même flag. Les deux modes staging/production sont testés ; ne pas activer le simulateur en bundle public. Le registre est serveur uniquement.

Navigation same-tab, ticket fragment retiré, grant destinataire préparé, lecture/confirmation scoped et retour Store configuré conservés. URL Stripe officielle avec fragment autorisée ; origines arbitraires/credentials refusés. Cart clearing seulement après preuve PAID exacte et snapshot/révision compatibles. Shipping 5 EUR sous 200 avant remise, 0 à partir de 200 ; 11 − 1,10 + 5 = 14,90 EUR.

## E2E navigateur et Stripe TEST — préparés, NON exécutés

Après release staging autorisée, vérifier SHAs effectivement servis, schéma/guards, modes TEST et origines exactes avant toute création/paiement. Utiliser un nouveau profil et des données synthétiques ; ne pas effacer les tentatives existantes. Aucun HAR/export contenant grants, ticket, cookies, PII ou URL complète Stripe.

1. Desktop + mobile 320/375/390/430 : Store → panier fixture 11 EUR STAGE10 → 14,90 ; seuil 199,99/200 avant remise et total sans remise supplémentaire de shipping.
2. Double clic, réponse perdue, reload/back : une commande, une tentative cohérente ; navigation same-tab sans popup ni pairing manuel.
3. Checkout exact-order : fragment nettoyé avant tiers ; grant seul du destinataire ; mauvais ordre/token absent/expiré/révoqué refusés. Aucun orderId seul suffisant.
4. `/pay` renvoie URL exacte checkout.stripe.com avec fragment accepté. Paiement uniquement avec moyen de test Stripe et compte TEST indépendamment confirmé. Vérifier livemode=false côté fournisseur, 1490 cents EUR, ordre/attempt exacts ; préfixe cs_test seul insuffisant.
5. Webhook/confirmation : paiement confirmé par backend, montant/session/attempt exacts, finalisation unique ; bouton continue-shopping revient au Store. Panier modifié depuis tentative conservé ; panier exact acheté vidé seulement après preuve.
6. Annulation/refus, reload confirmation et callback retardé : pas de faux PAID, pas de montant recalculé. Tests de replay fournisseur/concurrence uniquement après autorisation séparée ; préférer d'abord le simulateur local.
7. Historique : admin lecture possible, guest/pay/recovery/handoff/admin mutation refusés, aucune ancienne ligne modifiée ; monitoring des refus sans secret. Arrêter au premier résultat incohérent.

Consigner preuves expurgées (SHA, scénario, status, montant, mode, résultat), pas de nouveaux secrets. Les succès navigateur antérieurs à SecureOrderPolicy ne valident pas cette release.

## Rollout et rollback futurs

Ordre conditionnel : inventaire/transition/webhooks validés → backup/restore et autorisation migration → fenêtre maintenance → migration additive et audit → backend policy-aware → Checkout receiver → Store issuer → smoke/E2E TEST autorisés → monitoring. Aucun de ces changements distants n'a été exécuté.

Rollback applicatif UNIQUEMENT vers un artefact revu qui comprend SecureOrderPolicy, guards et schéma additive. **c05b810… actuel n'est pas un rollback sûr après activation** : il ignore le registre. Préparer un artefact de repli policy-aware avant release ; si aucun n'existe, rester en maintenance/refus plutôt que revenir au commerce anonyme. Ne pas supprimer table, registre, grants, tickets, réservations ou snapshots. Garder redemption des tickets émis ; stopper l'émission ne doit pas invalider leurs destinataires. Startup production toujours bloqué.

## Validation et derniers blocages

Résultats actualisés : voir `STAGING_RELEASE_VALIDATION.md`. Première relance Docker interrompue avant migrations à cause d'une course de readiness (serveur temporaire sur socket). Les deux runners utilisent maintenant TCP 127.0.0.1 pour readiness et lecture version ; environnement Docker synthétique local uniquement. Les anciens logs ne sont pas transformés en preuve distante.

Blocages : inventaire staging et obligations historiques inconnus ; traitement retries/alertes non opérationnalisé ; backup/restore et comparaison distante des 17 migrations non réalisés ; artefact rollback policy-aware à préparer ; E2E navigateur et paiement TEST de cette release non exécutés. Rien ne justifie une levée du stop production.

```text
LOCAL_IMPLEMENTATION_REVIEW=GO
STAGING_LEGACY_INVENTORY=UNKNOWN
HISTORICAL_WEBHOOK_MUTATION=DENIED
HISTORICAL_WEBHOOK_RETRY_POLICY=BLOCKED_PENDING_REVIEW
BROWSER_AND_STRIPE_TEST=PREPARED_NOT_EXECUTED
PRODUCTION_STARTUP_BLOCKER_REMOVED=NO
REMOTE_CHANGES_PERFORMED=NO
READY_FOR_STAGING_RELEASE=NO
STAGING_GO_NO_GO=NO_GO
```
