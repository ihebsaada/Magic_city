# Validation Stripe hors ligne — 10 octobre 2026

## Portée et résultat

**LOCAL_VALIDATION_GO=YES pour les contrôles exécutés ; PRODUCTION_DEPLOYMENT_GO=NO.** Pas de certification du parcours complet PostgreSQL/navigateur/fournisseur dans cette passe. Aucune connexion distante, migration (locale ou distante), credentials réels modifiés, commit/index/push/deploy. docs/ et diffs existants préservés ; stop production actif.

La dernière instruction interdit les migrations. Les runners run-pg18, run-regression-pg18, start.cjs et test:integration en exécutent : ils ont donc été exclus. Les anciens 508 PASS restent une preuve antérieure, PAS des tests fraîchement exécutés du correctif Stripe.

## Infrastructure réutilisée et nouveau complément

Réutilisés : release-check.cjs, suites Backend/Store/Checkout, common-access-tests.cjs, VM du client Stripe et le SDK Stripe installé pour signature/validation réelles.

Nouveaux fichiers Store/outillage :

- tools/staging/offline-stripe.cjs : fournisseur en mémoire, horloge injectée fixe par défaut, IDs dérivés de clé, requêtes canonisées, copies isolées, idempotence/conflits, fautes avant/après création, complete/expire, événements signés synthétiques.
- tools/staging/offline-stripe.test.cjs : 9 tests ; toute ouverture de socket/fetch dans cette suite échoue immédiatement. Aucun navigateur n'ouvre checkout.stripe.com. Aucun client HTTP Stripe simulé ne contacte un service.
- tools/staging/validate-stripe-offline.cjs : environnement enfant whitelist sans PG_*/Stripe/JWT/NODE_OPTIONS hérités, URL DB synthétique loopback port 1 jamais contactée ; builds locaux, tests offline et probe PostgreSQL 18 sans migration. Résultats/builds/logs sous release-review/stripe-offline, ignorés.
- Les deux présents rapports. Cinq fichiers backend modifiés sont détaillés dans STRIPE_ENV_COMPATIBILITY.md.

Le simulateur n'est pas une seconde implémentation de la finalisation/persistance commerciale. Il complète les tests existants de montants/réservation/guest/handoff, sans copier leur moteur. État du simulateur purement mémoire, pas de garantie multi-processus/durable ; cette garantie reste à la base applicative et à la quarantaine déjà testées dans les passes antérieures.

Signature : vrai HMAC et constructEvent du SDK ; tolérance 300 secondes conservée. Le test fournit un receivedAt cohérent avec son horloge injectée pour être déterministe et vérifie aussi l'expiration. Aucun changement de tolérance/horloge dans le handler runtime.

## Résultats réels de cette passe

| Contrôle | Résultat |
| --- | --- |
| Backend non-DB/mock/HTTP loopback | 51 PASS |
| Store | 118 PASS |
| Checkout | 92 PASS |
| Cross-app source/VM | 20 PASS |
| Nouveau simulateur offline | 9 PASS |
| Total actuel | **290 PASS** |
| Backend build/TypeScript | PASS |
| Frontend TS app/node/tests et builds staging locaux | PASS |
| Prisma validate | PASS |
| PostgreSQL 18.6 local, identité/transaction READ ONLY | PASS, probe séparé du total tests |
| PostgreSQL applicatif / nouvelles migrations | NON EXÉCUTÉ, interdit dans cette passe |
| Navigateur E2E / paiement Stripe TEST | NON EXÉCUTÉ |
| Diff/cached checks et index trois worktrees | PASS / index vides |

Le probe lance un nouveau conteneur PostgreSQL 18 sans réseau ni port publié, stockage tmpfs et utilisateur synthétique. Seul SQL émis : BEGIN REPEATABLE READ READ ONLY, SELECT garde identité/version/read-only, SELECT version, ROLLBACK. PostgreSQL **18.6**, transaction_read_only=on observés. Aucun schéma applicatif créé, aucune fixture ni DDL/DML/migration. Conteneur propre arrêté dans finally ; aucun cluster utilisateur touché. Ce probe ne prouve PAS la compatibilité de toutes les migrations avec cette nouvelle révision.

Les 9 tests couvrent déterminisme/montant1490/devise/URLfragment, réponses immuables, 8 créations concurrentes avec même clé, conflit de paramètres, perte de réponse avant/après création, expiration/complete, signature réelle altérée/mauvais secret/timestamp expiré, paramètres invalides, modes create/retrieve staging/production incorrects ou manquants, destinataires staging bloqués avant effet fournisseur.

Incidents consignés : première invocation offline avait un require sans extension .cjs, corrigé. Première régression backend a révélé que l'ancien faux SDK production ne définissait que retrieve ; mock complété avec create, sans branche de contournement runtime. Dernières relances : tous les contrôles exécutés PASS. Aucune conclusion de succès navigateur/DB applicative inventée.

## Commandes exécutées

Depuis Magic_city_git :

```powershell
node tools/staging/validate-stripe-offline.cjs
node tools/staging/audits/2026-10-10-production-readiness/release-check.cjs
```

Le premier compile le backend, exécute node --test --test-reporter=tap tools/staging/offline-stripe.test.cjs, construit les deux frontends avec Vite --mode staging dans les sorties isolées et sonde PostgreSQL en lecture seule. Le second recompile et exécute les suites existantes, tsc --noEmit des projets et Prisma validate. Pas de npm ci, migration, import, seed ou appel fournisseur. Git diff --check, git diff --cached --check et vérification des branches/index dans chaque worktree, sans staging Git.

Les tests source/VM n'établissent pas le rendu réel desktop/mobile, la navigation same-tab/COOP ou le fonctionnement d'une session Stripe distante. Le harness navigateur complet exige une base applicative initialisée ; aucun cluster applicatif conservé qualifié n'était fourni et son initialisation migrerait. Il n'a pas été démarré pour contourner l'interdiction.

## Rollback actualisé et limites

Nouvelle archive SOURCE policy-aware incluant ces correctifs : release-review/rollback-1791646165283/backend-policy-aware.zip, **154371 octets**, SHA-256 `2ee60fe09a3e2c6cb24cc68f927a0ec388f963e7a1639622edee7fa234dadef8`. Extraction/manifeste SHA par fichier PASS. L'archive précédente reste conservée, mais ne contient pas les présents correctifs Stripe. Aucune archive dans l'index. Qualification binaire Linux et repli E2E restent à faire ; ne pas revenir au backend pré-SecureOrderPolicy.

## Prochaine action exacte

Revoir les cinq fichiers backend et les trois fichiers d'outillage, puis autoriser séparément une validation **PostgreSQL 18 applicative locale synthétique avec application des 18 migrations**, suivie d'un E2E navigateur au simulateur local. Tant que les migrations restent interdites, cette validation complète reste en attente. Après seulement : contrôles staging distants read-only, backup/restore, obligations/alertes et autorisations de release distinctes. Aucun paiement TEST distant ni opération LIVE demandé implicitement.

```text
LOCAL_TESTS=290_PASS
POSTGRES18_READ_ONLY_PROBE=PASS
POSTGRES_APPLICATION_REGRESSIONS=NOT_RUN_THIS_PASS
BROWSER_E2E=NOT_RUN
STRIPE_REMOTE_ACTIONS=NONE
MIGRATIONS_EXECUTED=NO
LOCAL_VALIDATION_GO=YES_EXECUTED_SCOPE_ONLY
FULL_OFFLINE_END_TO_END_VALIDATED=NO
PRODUCTION_STARTUP_BLOCKER_REMOVED=NO
PRODUCTION_DEPLOYMENT_GO=NO
```
