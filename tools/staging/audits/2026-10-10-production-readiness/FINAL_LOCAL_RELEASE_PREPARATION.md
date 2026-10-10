# Préparation finale locale de release — 10 octobre 2026

## Décision

**GO pour revue des commits sélectifs et du rollback Linux local ; NO-GO pour release staging distante et production.** Aucun index, commit, push, déploiement, accès Render/Stripe/DB distante ou changement de permissions PostgreSQL. PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED reste actif. Les anciennes données distantes n'ont pas été contactées ; les snapshots historiques synthétiques restent identiques. docs/ et tous les diffs applicatifs préexistants sont préservés.

Branches relues : staging/store @ 1faef44a5e7914bc6e338ba76073ac13658cd2fd ; staging/checkout @ f3052ebd5ea1628d0a3977c069ce2817ed9b08ef ; staging/backend @ c05b8102c7b819febc0b95ed84fd59f346738b14. Les changements de cette préparation sont dans l'outillage/documentation Store uniquement, pas dans les applications.

## Manifeste définitif et commandes préparées

**FINAL_COMMIT_MANIFEST.md** contient chaque chemin relatif, sans ajout récursif :

| Commit proposé | Fichiers |
| --- | ---: |
| Backend : feat(backend): enforce secure order policy and quarantine historical webhooks | 39 |
| Checkout : feat(checkout): support explicitly configured secure production handoff | 3 |
| Store : feat(store): support secure handoff and shipping in production mode | 3 |
| Outillage/docs Store : test(staging): qualify offline browser flow and policy-aware Linux rollback | 47 |
| Total sélectionné | **92** |

Les listes anciennes omettaient stripeApiVersion.ts et décrivaient à tort le template backend comme non suivi. `.env.staging.example` est maintenant confirmé **suivi par Git** et ne contient que des placeholders ; il est inclus, sans git add -f. Aucun .env réel inclus. Les deux nouvelles migrations, leurs guards et tests doivent rester dans le même commit backend : ne pas publier seulement le schéma.

**SELECTIVE_COMMITS_REVIEW_ONLY.ps1** contient les commandes exactes : branche, index vide, `git add --` avec chaque fichier explicitement nommé, comparaison de la liste staged, `git diff --cached --check`, stat et diff complet, approbation humaine puis le message de commit. Un `throw REVIEW_ONLY` inconditionnel en tête empêche toute exécution accidentelle. Le script n'a PAS été exécuté ; ne retirer ce stop qu'après une nouvelle autorisation explicite. Aucun push/merge/deploy n'y figure. Les fichiers SQL d'administration sont des documents de revue inclus explicitement, jamais des hooks ou commandes de release.

Exclusions : docs/ préexistant ; .runtime ; node_modules/dist/builds/caches ; tous les JSON/logs/captures/preuves et TAR de release-review ; copies baseline/remediation/legacy-compatibility ; textes générés pg18-simulation/*.txt ; dumps, anciens clusters .pg-*, archives et environnements réels. .gitignore est complété pour les quatre anciens résultats TXT de simulation. Rien n'est supprimé. Aucun git add . ou ajout d'un dossier entier.

Un scan ciblé des 92 candidats et des 87 fichiers source du snapshot est exécuté avant clôture : clés Stripe réalistes, URI PostgreSQL avec credentials non synthétiques, clés privées complètes, chemins de données/artéfacts/environnements interdits. Les occurrences synthétiques/documentaires sont distinguées. Ce scan n'est pas une certification de l'historique Git entier, des credentials privés non sélectionnés ou de toute PII. Une revue du diff staged restera obligatoire au moment du commit autorisé ; les index sont restés vides ici.

Résultat final du scan ciblé : PASS, aucune correspondance réelle identifiée. Un candidat URI du checklist a été examiné sans exposer ses champs : hôte/user/password explicitement documentaires, classé placeholder ; pas un secret réel. Preuve FINAL_SCOPE_SCAN.json ignorée. Git diff/cached checks PASS sur les trois worktrees, HEAD inchangés, zéro fichier staged. Syntaxe du script PowerShell de revue vérifiée sans exécution des commandes.

## Revue simulateur et Playwright

Le simulateur conserve origine exacte + preuve signée avant outcomes, verrou session, refus de régression d'une session payée et webhook signé vers les vrais handlers. Aucune écriture directe Order/OrderItem ajoutée. Correction locale de revue : le retour d'annulation dérive désormais de la destination fiable de la session, conservant aussi le harness commun préfixé ; il n'impose plus toujours le Checkout séparé 5174. Le navigateur vérifie origine/path exacts, absence de credentials/hash. La branche finale séparée est rejouée ; la branche commune préfixée est revue statiquement, pas exécutée en navigateur dans cette passe.

Le runner utilise des contextes vides, quatre origines loopback exactes, service workers/WebSockets bloqués, captures masquées, aucune exportation de tokens/URL de session/cookies. Ses chemins Playwright/Edge restent spécifiques au poste Windows et sont documentés, pas des dépendances applicatives déployées.

Résultat après cette correction : **Edge réel 7/7 PASS**, zéro réponse externe ; dernier dossier `release-review/playwright/run-1791649278881/`. **HTTP/VM 9/9 PASS**, preuve `release-review/final-preparation-http.log`. Ces groupes ne sont pas additionnés au nombre de tests unitaires comme des assertions uniques. Le parcours utilise uniquement Stripe simulé et données fictives.

## Artefact Linux réellement construit et qualifié

Artefact final :

```text
IMAGE=magiccity-policy-rollback:linux-1791649056647
IMAGE_ID=sha256:90b6e6886c8b12d9d18b6f4b19d2f6375dd874f6f857f15dd070ddb8100c54e0
OS_ARCH=linux/amd64
NODE=24.19.0
RUNTIME_USER=node
ARCHIVE=release-review/rollback-1791649056647/backend-policy-aware-linux.tar
SIZE_BYTES=125188608
SHA256=045ff46b90142871d2bb0dfad07f30ca43d637565f8fd4671af8f8fbe2380988
```

Chemin absolu : `C:\Users\hp\Desktop\work\magic city\Magic_city_git\tools\staging\audits\2026-10-10-production-readiness\release-review\rollback-1791649056647\backend-policy-aware-linux.tar`.

Le snapshot source contient **87 fichiers**, empreintes SHA-256 individuelles dans MANIFEST.json, comparées avant build. `rollback-linux.Dockerfile` épingle Node officiel au digest `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`. L'image Node n'était pas en cache : téléchargement Docker Hub nécessaire ; npm et paquets Debian/engines Prisma téléchargés pendant build. **Ce build n'est donc pas un build sans réseau.** Aucun accès Render/Stripe ; aucun credential réel transmis. Les tests de qualification utilisent ensuite Docker `--network none` ou le namespace réseau du nouveau PostgreSQL lui-même sans réseau ni port publié.

Build multi-stage : npm ci depuis lockfile avec scripts d'installation désactivés, génération Prisma Linux, TypeScript, contrats, prune des devDependencies. Image finale : dist, dépendances production et moteur Prisma Linux, package/lock, schéma et 18 migrations ; aucun test/source/copie de base/.env réel inclus. Bcrypt natif et Prisma sont exercés. CMD = `node dist/server.js`, utilisateur non-root node, aucun seed/migrate au démarrage. Staging nécessitera son entrée explicitement configurée `node dist/stagingServer.js` ; aucun paramètre distant changé ici.

`qualify-linux-rollback.cjs` prépare uniquement des PostgreSQL **18.6** neufs, tmpfs, sans réseau, sans port publié. Deux clusters distincts isolent les suites qui nettoient leurs fixtures. Baseline sans SecureOrderPolicy, insertion de fixtures historiques, application du registre puis tests sur **l'image runtime finale** avec tests montés read-only. Les 18 migrations sont appliquées uniquement à ces clusters. Hash des Order/OrderItem historiques avant/après identique dans les deux matrices.

| Qualification Linux | Résultat réel final |
| --- | --- |
| Node Linux / TypeScript / Prisma generate | PASS |
| Contrats backend dans image de qualification | 53 PASS |
| Contrats backend répétés dans l'image runtime non-root, sans réseau | 53 PASS, mêmes cas, non additionnés |
| PostgreSQL idempotence/paiement/réservations/guest/handoff/navigation/catalogue | 203 PASS |
| PostgreSQL SecureOrderPolicy/quarantaine historique | 25 PASS |
| Total des cas Linux distincts exécutés | **281 PASS** |
| Guards paiement/guest/réservations/handoffs/réconciliation/quarantaine | PASS dans dist |
| Contrat Stripe absent/vide/version exacte ; rejet incompatible | PASS ; SDK et constante correspondent |
| Blocage production | PASS ; fonction conservée et test du démarrage avant clients dans les contrats |
| Bcrypt natif et Prisma Linux, transactions réelles | PASS |
| TAR exporté puis docker load local | PASS ; même IMAGE_ID après chargement |

Preuves : `release-review/rollback-1791649056647/LINUX_ARTIFACT.json`, LINUX_RESULTS.json, linux-*.log, MANIFEST.json. Archives, copies source/builds et logs sont exclus des commits. L'image rechargée est locale seulement ; aucune publication registry ni déploiement.

Incidents conservés : premier snapshot incomplet (fixtures catalogue omises) ; tentative de sélection récursive trop large interrompue, remplacée par une allowlist top-level .cjs + tests/fixtures/*.cjs, sans ancien cluster inclus dans le snapshot final ; première matrice commune effaçait une fixture par le nettoyage prévu des tests d'idempotence, donc séparation en deux clusters neufs ; fixture policy initialement dépourvue de la référence Stripe fictive attendue, corrigée pour reproduire celle des runners existants. Les logs des échecs sont conservés. Aucun guard ni assertion métier affaibli ; aucune mutation historique distante. Seul l'artefact final ci-dessus est qualifié.

## Changements de cette préparation

- tools/staging/backend.cjs : correction du retour d'annulation synthétique.
- audit/.gitignore ; prepare-policy-rollback.cjs : fixtures imbriquées explicitement autorisées, anciens clusters exclus.
- Nouveaux rollback-linux.Dockerfile et qualify-linux-rollback.cjs.
- FINAL_COMMIT_MANIFEST.md, SELECTIVE_COMMITS_REVIEW_ONLY.ps1, ce rapport ; annotation de STAGING_COMMIT_CANDIDATES.md.

Aucune nouvelle modification des applications Backend/Store/Checkout. Les diffs préexistants sont conservés et inclus selon le manifeste. Les builds/artefacts ne changent pas les sources ni les index.

## Risques et prochaines conditions

Le TAR est un artefact exécutable Linux qualifié localement, pas une autorisation de démarrage distant. Architecture du service cible, configuration, digest servi et contraintes de plateforme doivent être validés. Les paquets Debian ne sont pas épinglés individuellement : conserver le TAR/digest qualifié plutôt que supposer qu'un rebuild futur est identique. Audit supply-chain/CVE exhaustif et signature externe de l'artefact non réalisés.

Après activation du registre, rollback uniquement vers cet artefact policy-aware ou un autre explicitement qualifié. **Jamais vers c05b810 historique**, qui ignore le registre. Ne pas supprimer/revenir en arrière sur migrations, receipts, grants, réservations ou snapshots. Si le schéma attendu manque, refus fermé/maintenance ; pas de fallback anonyme. Cette image impose toujours le blocage production et ne constitue pas une solution pour le lever.

Restent : inventaire staging READ ONLY, migrations/checksums/objets réels, obligations de paiements historiques TEST/LIVE/SumUp, backup/restore validés, revue PENDING/CRITICAL opérationnelle, assistance/recovery nouveaux clients, configuration et final-flow réellement déployé. Aucun de ces contrôles distants effectué ou implicitement autorisé. Les anciens parcours sans registre restent admin-only sans backfill.

Prochaine action : **revue humaine des 92 fichiers et des commandes préparées**, puis autorisation explicite distincte pour les commits locaux. Les contrôles distants et toute release nécessitent leurs propres autorisations. Tous les conteneurs de qualification et du navigateur sont arrêtés à la clôture ; aucun cluster utilisateur touché.

```text
SELECTIVE_COMMIT_MANIFEST=92_FILES_4_PROPOSED_COMMITS
LINUX_ROLLBACK_ARTIFACT=BUILT_EXPORTED_LOADED_QUALIFIED
LINUX_TESTS=281_PASS_DISTINCT_CASES
BROWSER_GROUPS_RERUN=7_PASS
HTTP_VM_GROUPS_RERUN=9_PASS
PRODUCTION_STARTUP_BLOCKER_REMOVED=NO
COMMITS_EXECUTED=NO
REMOTE_CHANGES_PERFORMED=NO
LOCAL_RELEASE_PREPARATION_GO=YES_FOR_REVIEW
REMOTE_STAGING_DEPLOYMENT_GO=NO
PRODUCTION_DEPLOYMENT_GO=NO
```
