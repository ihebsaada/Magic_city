# Résolution locale des blocages staging — 10 octobre 2026

## Décision : GO revue locale ; NO-GO release distante

Anciennes commandes conservées, sans backfill ni modification Order/OrderItem. Sans registre : admin-only ; toute obligation active impose STOP/revue. `PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED` inchangé. Aucun commit/index/push/deploy, accès Render/production, migration distante, paiement Stripe/SumUp ou modification PUBLIC. Les diffs préexistants et docs/ sont préservés.

Sources de décision relues : STAGING_GO_NO_GO, SECURE_ORDER_POLICY_IMPLEMENTATION, LEGACY_COMPATIBILITY_PRODUCTION_PLAN et rapports de remédiation/inventaire antérieurs. Les conclusions distantes UNKNOWN ne sont pas transformées en PASS par les simulations.

## Résolu localement

- Réception historique durable : nouveau `services/historicalWebhookReceipt.ts`, branche dédiée du controller webhook et table additive `HistoricalWebhookReceipt` ; production/staging conservent leurs signatures et modes stricts. Le nouveau champ interne `SecureOrderPolicyError.orderId` permet d'identifier la cible refusée, y compris après une lecture Stripe simulée ; il n'est pas exposé dans les réponses d'erreur.
- La transaction verrouille la commande en lecture `FOR UPDATE`, recontrôle l'absence de policy, refuse une commande inconnue, un registre présent/invalide et les contradictions de références. Un verrou consultatif sérialise aussi eventId ; l'index PK déduplique. `synchronous_commit=on`, receipt + alerte PENDING dans la même ligne et transaction. Le HTTP 200 arrive APRÈS commit, indique explicitement `commercialProcessing=false` et `historical_quarantined`. Aucun faux PAID ni événement de finalisation commerciale.
- Payload/event/session uniquement empreintes ; alias ordre HMAC dédié par domaine avec le secret handoff existant ; WARNING TEST, CRITICAL LIVE. Aucun raw body, token, signature, PII ou identifiant complet paiement/session persistant ou journalisé. Doublon identique : même décision ; contenu différent pour le même event : 409, revue requise. Erreur DB/classification : 503, pas d'ACK en mémoire. Mode contradictoire/signature invalide : 400, aucune réception persistée.
- Le 200 acquitte la livraison technique durable, pas le paiement historique ; il évite la répétition liée à l'ancien refus 409 quand la livraison est valide et persistée. Il ne prétend pas résoudre une obligation fournisseur, ni garantir le comportement du réseau. Aucune action fournisseur réalisée.
- Les anciennes routes guest/pay/confirmation/récupération et mutations admin restent refusées. Les commandes modernes suivent toujours reconciliation/montant/attempt/session/reservations existants. Shipping et snapshots inchangés.

Procédure et requête de suivi : `HISTORICAL_WEBHOOK_REVIEW_RUNBOOK.md`. File PENDING durable implémentée ; transport externe/monitoring et responsable de revue restent à configurer/valider. Aucun email, job de purge, réexécution historique ou endpoint public d'alerte ajouté.

## Migration additive

Nouvelle `20261010150000_add_historical_webhook_receipt`, après SecureOrderPolicy. 18 migrations locales maintenant. Table indépendante du commerce : eventHash CHAR(64) PK, payloadHash/orderAlias/sessionHash, eventType, livemode, décision fixe HISTORICAL_QUARANTINED, reviewState PENDING/REVIEWED, severity WARNING/CRITICAL, createdAt et index reviewState/createdAt. Aucun FK/cascade qui modifierait une commande, aucun backfill, UPDATE/DELETE/ALTER Order/OrderItem. Pas de changement de permissions PostgreSQL.

Le schéma Prisma inclut le nouveau modèle ; generate/validate/compilation PASS. Migration appliquée seulement à des clusters synthétiques PostgreSQL 18.6. Historique Order/OrderItem hash identique avant/après SecureOrderPolicy, et assertions finales de snapshots identiques après tous les webhooks/tests. Comparaison des 18 migrations/checksums/objets distants et backup requis avant toute autorisation de migration réelle ; pending distant UNKNOWN.

## Tests exécutés et incidents

Backend non-DB/mock/HTTP : 50 PASS ; Store 118 PASS ; Checkout 92 PASS ; cross-app 20 PASS. PostgreSQL régression : 203 PASS ; matrice policy/quarantaine : 25 PASS. **Total 508 PASS**, sans compter la seconde navigation 13 exécutée par le runner ciblé. TypeScript trois projets (app/node/tests frontends), builds trois projets, Prisma generate/validate PASS. Diff/cached checks et index vides vérifiés en fin de revue.

Les nouveaux tests couvrent doublons/concurrence 8 deliveries, collision de payload, DB receipt indisponible, policy indisponible, rollback réel après insertion, replay dans un autre processus Node, session inconnue résolue par faux fournisseur, signature/mode/reférence contradictoires, LIVE/TEST historiques simulés et snapshots finaux inchangés. Aucun Stripe réel. Les garde-fous existants d'atomicité, montant 1490 EUR cents, guest/handoff, idempotence et absence de finalisation historique repassent.

Incidents non masqués : Docker Desktop était arrêté (aucun conteneur créé au premier essai) ; démarré localement. Premier test de quarantaine a échoué 503 à cause du résultat SQL `void` du verrou consultatif non désérialisable par Prisma. Correction `$executeRaw` au lieu de `$queryRaw` pour ce verrou, puis matrice complète PASS. Aucun contournement de contrôle. Dernières preuves : release-review/*.log et secure-policy/policy-tests.log, regression-*.log ; artefacts générés ignorés. Les premiers échecs sont consignés ici, pas présentés comme PASS.

## Rollback préparé

Archive source figée : `release-review/rollback-1791642561752/backend-policy-aware.zip`.

- Taille : 154176 octets.
- SHA-256 : `d8d54887d7be8df17c63e01279072dbf81c947a3e67dfba6e199a06c9eb1b96b`.
- 84 fichiers source/config lock/migrations/tests ; manifeste SHA-256 par fichier ; extraction et comparaison de toutes les empreintes PASS. Scan ciblé avant copie, aucun .env réel, node_modules, build, log, dump ou secret réel inclus. Guards des services et stop production explicitement vérifiés.
- Générateur reproductible local : `prepare-policy-rollback.cjs`. Archive exclue de Git. Les 18 migrations et la quarantaine sont incluses ; pas d'ancien backend c05b810 comme repli.

**Limite : archive SOURCE, pas image binaire Linux prête à déployer.** Avant release, construire/qualifier un artefact immuable sur la plateforme cible depuis ces sources/lock, vérifier ses guards avec la base additive et archiver son digest. Npm ci/build n'exécute jamais de migration via ce runbook. Production reste bloquée. Le rollback est applicatif policy-aware, conserve tables/registrations/receipts/grants et refuse fermé si indisponibles. Aucun downgrade de schéma ni restauration destructive automatique. Faute de binaire qualifié, maintenance plutôt que retour à un backend incompatible.

## Commits sélectifs préparés, NON exécutés

`STAGING_COMMIT_CANDIDATES.md` contient les listes exactes. Les 40 candidats précédents sont conservés ; deux nouveaux fichiers backend (service + migration) portent le total à **42 : Backend 36, Store 3, Checkout 3**. Proposition :

1. Backend : `feat(backend): enforce secure order policy and quarantine historical webhooks` — les 36 candidats, configuration/tests inclus, stop production conservé.
2. Checkout : `feat(checkout): support explicitly configured secure production handoff` — 3 candidats existants, aucun changement frontend nouveau.
3. Store : `feat(store): support secure handoff and shipping in production mode` — 3 candidats existants, aucun changement frontend nouveau.
4. Documentation/outillage Store séparé, liste explicite dans le manifeste ; aucune inclusion récursive.

Exclure docs/ préexistant, .runtime, node_modules, dist/builds, logs, JSON de résultats, copies baseline, archives rollback/dumps, preuves temporaires et secrets. .gitignore de l'audit déjà présent conservé. Aucun `git add .`, aucune modification d'index. Le scan ciblé n'est pas une certification de tout l'historique Git.

## Contrôles distants restant à autoriser

1. Inventaire staging READ ONLY : `STAGING_TRANSITION_READ_ONLY.sql` enrichi avec aliases orderNumber, états/montants figés, dépendances par ordre, orphelins, grants/réservations et alertes ; aucune PII/token/session complète. Garde magiccity_db_staging, REPEATABLE READ READ ONLY, ROLLBACK. Avant connexion : URI staging exacte, hostname égal à STAGING_DATABASE_HOST indépendamment confirmé, TLS, aucune cible production. Variables dédiées absentes du processus lors du preflight précédent ; aucune connexion tentée ici. Nouveau script revu statiquement, pas exécuté sur serveur distant.
2. Comparer tous les checksums/historiques/objets/contraintes distants aux 18 locaux. Tout objet partiel, migration échouée ou autre pending inattendu : STOP. Ne pas supposer deux migrations seulement.
3. Revue Stripe TEST read-only : obligations ouvertes/asynchrones/deliveries et compte exact. Tout indice LIVE en DB ou fournisseur : STOP. Préfixes seuls ne prouvent pas l'absence de paiements. Décision propriétaire admin-only conservée ; une obligation active ne peut être ignorée ni finalisée implicitement.
4. Backup custom complet pg_dump 18 + hash/list + restauration réelle dans un conteneur sans réseau : `STAGING_BACKUP_RESTORE_PLAN.md`. Commandes préparées, NON exécutées. Aucun changement PUBLIC ni restauration distante.
5. Désigner surveillance PENDING/CRITICAL, délai de revue et responsable ; valider procédure de clôture/assistance sans mutation historique. File durable n'équivaut pas à alerte externe déjà livrée.
6. Qualifier binaire Linux de rollback policy-aware et fenêtre maintenance ; puis seulement demander autorisations migration/deploy distinctes.
7. Après release autorisée : E2E navigateur et paiement Stripe TEST complet de STAGING_GO_NO_GO (14,90 EUR, seuil 200, reprise, grants, finalisation et retour Store). NON exécutés dans cette passe.

## Risques / critères de GO

Les anciennes tentatives staging ne reprennent plus sans policy, aucun backfill proposé. L'ACK historique transfère l'obligation à une revue humaine durable, sans la résoudre ; PENDING ignoré serait une faute opérationnelle. Une erreur DB ou conflit reste non-2xx volontairement. Capacité/retention de receipts et monitoring à valider ; aucun effacement automatique. Le hash complet du payload rend un eventId réémis avec contenu différent conflictuel, nécessitant revue. Les clés/empreintes doivent rester privées.

GO distant seulement après inventaire/obligations PASS, backup/restore PASS, migrations autorisées puis audit PASS, monitoring/revue validés, rollback Linux qualifié, configuration staging contrôlée et E2E TEST final autorisé/PASS. La levée du stop production est hors scope et demeure interdite.

```text
HISTORICAL_WEBHOOK_DURABLE_QUARANTINE=PASS_LOCAL
HISTORICAL_ORDER_ITEM_MUTATIONS=NONE_SYNTHETIC_VERIFIED
WEBHOOK_ALERT_OUTBOX=IMPLEMENTED_PENDING_REVIEW
EXTERNAL_ALERT_TRANSPORT=NOT_CONFIGURED
ROLLBACK_SOURCE_ARTIFACT=PREPARED_INTEGRITY_PASS
ROLLBACK_LINUX_BINARY=NOT_QUALIFIED
LOCAL_TESTS=508_PASS
REMOTE_INVENTORY_BACKUP_MIGRATIONS=NOT_EXECUTED
BROWSER_STRIPE_TEST=PREPARED_NOT_EXECUTED
PRODUCTION_STARTUP_BLOCKER_REMOVED=NO
READY_FOR_LOCAL_REVIEW=YES
READY_FOR_REMOTE_STAGING_RELEASE=NO
STAGING_GO_NO_GO=NO_GO
```
