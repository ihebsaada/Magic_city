# Validation intégration hors ligne — 10 octobre 2026

> Mise à jour : PLAYWRIGHT_OFFLINE_E2E.md documente maintenant 7/7 groupes exécutés dans Edge réel via Playwright local. Le blocage navigateur décrit ci-dessous est levé pour cette matrice locale seulement ; les verdicts de déploiement distant restent NO. Ce rapport conserve les preuves de la passe antérieure.

## Verdict

**LOCAL_FULL_OFFLINE_E2E_GO=NO : navigateur indisponible.** Les validations applicatives PostgreSQL, HTTP/VM, TypeScript et builds exécutées passent. Aucun parcours navigateur n'a été exécuté : Computer Use retourne `apps: [], browsers: []`, y compris après la demande de connexion ; IAB et Chrome ont répondu `Browser is not available`. Un succès HTTP/VM ne remplace pas cette preuve.

REMOTE_STAGING_DEPLOYMENT_GO=NO ; PRODUCTION_DEPLOYMENT_GO=NO. Aucun accès Render/base distante/API Stripe, clé réelle, commit/index/push/déploiement ou changement de permissions distantes. Le stop PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED est conservé. Les modifications antérieures et docs/ sont préservées.

## Contrat STRIPE_API_VERSION

Le SDK installé et verrouillé, stripe 20.1.0, utilise `2025-12-15.clover`. Un validateur partagé accepte uniquement l'absence, la chaîne vide ou cette valeur exacte. Une autre version, un espace ou une version future provoque STRIPE_API_VERSION_INCOMPATIBLE avant startup. Les tests staging/production comparent aussi la constante au SDK installé, pour détecter une évolution du lockfile. Aucune nouvelle variable Stripe obligatoire ; aucune suppression imposée de la variable Render. Aucune configuration distante lue ou modifiée. Le SDK utilise son défaut pour une valeur vide/absente ; la version explicite correspond au même contrat.

Cette section remplace la recommandation « override interdit/unset obligatoire » des rapports antérieurs. Elle ne valide pas les valeurs réellement présentes sur Render ni la version des événements d'une destination Stripe distante.

## Nouveaux clusters et isolation

Les runners existants run-regression-pg18.cjs et run-pg18.cjs ont créé chacun un nouveau cluster Docker synthétique, puis l'ont arrêté. PostgreSQL 18.6 observé ; les 18 migrations appliquées seulement à ces bases. Le runner de migration différentielle applique d'abord les migrations hors SecureOrderPolicy, crée une fixture historique, puis applique SecureOrderPolicy ; le runner de régression et le harness exécutent également les migrations locales. Aucune base utilisateur réutilisée.

Le nouveau mode `start.cjs --docker18 --final-flow` crée un conteneur neuf, image locale inspectée et version 18.6 vérifiée, port PostgreSQL publié uniquement sur 127.0.0.1, stockage tmpfs et identifiants fictifs. Il refuse la reprise d'un ancien runtime Docker. Les deux frontends, le backend et le fournisseur simulé utilisent les ports loopback 5173/5174/4100/4101. Les médias externes sont bloqués par la CSP du mode offline. Le faux SDK conserve ses sessions dans le schéma synthétique staging_simulator ; les signatures sont produites et vérifiées par le vrai SDK, sans appel fournisseur. Le simulateur déterministe en mémoire existant reste testé séparément.

Le harness HTTP construit createApp avec dépendances synthétiques ; il n'est pas un démarrage Render ni un contournement de son stop production. Les parsers d'environnement staging/production sont testés séparément avec valeurs fictives. Aucune protection de paiement/signature/mode n'a été désactivée.

## Résultats réellement exécutés

| Suite | Résultat final |
| --- | --- |
| Backend sans DB/mock/HTTP loopback | 53 PASS |
| Store | 118 PASS |
| Checkout | 92 PASS |
| Cross-app source/VM | 20 PASS |
| Simulateur déterministe offline | 9 PASS |
| PostgreSQL : idempotence/paiement/réservations/guest/handoff/navigation/catalogue | 203 PASS (16/30/48/42/15/13/39) |
| PostgreSQL : SecureOrderPolicy/quarantaine historique | 25 PASS |
| Total des suites, sans compter la navigation répétée | **520 PASS, zéro échec final** |
| Parcours final HTTP avec vrais endpoints et clients compilés en VM | **9/9 groupes PASS**, distincts du total ci-dessus |
| TypeScript Backend et app/node/tests des frontends | PASS |
| Builds Backend/Store/Checkout ; builds offline staging | PASS |
| Prisma validate | PASS |
| Git diff --check / cached --check, trois worktrees | PASS ; zéro fichier staged |
| PostgreSQL 18.6 probe READ ONLY | PASS |
| Navigateur Store → Checkout → faux Stripe → confirmation | **NON EXÉCUTÉ** |

Preuves expurgées : release-review/RESULTS.json, backend-tests.log, store-tests.log, checkout-tests.log, cross-tests.log ; release-review/stripe-offline/ ; secure-policy/regression-*.log et policy-tests.log ; release-review/full-offline-http-corrected.log. Les logs/builds/runtime restent hors index. Les 9 groupes ne sont pas 9 scénarios navigateur.

HTTP/VM : création concurrente avec clé stable, total 14,90 EUR, navigation same-tab sans popup, grants distincts, nettoyage du ticket/reload, origines/refus mauvais ordre et destinataire, réponse /pay perdue, même PaymentAttempt/session, une ligne Stripe agrégée à 1490 cents EUR, Origin:null refusée, webhook signé, confirmation exacte, finalisation unique, doublons et expired tardif sans régression PAID, absence de grants/tickets/proofs dans logs.

PostgreSQL : atomicité/rollback, concurrence, conflits d'idempotence, expirations/réservations, callbacks tardifs, accès invité, historique non admissible, DB/policy/receipt indisponibles, quarantaine durable et collisions/doublons, événements LIVE/TEST simulés, aucune finalisation historique. Les scénarios unitaires de panier/fingerprint/révision et retour Store repassent ; leur comportement visuel réel n'a pas été observé. Annulation/refus/expiration sont testés au niveau services/simulateur, pas par interaction dans un navigateur. Aucun résultat fournisseur revendiqué.

Snapshots : empreinte Order/OrderItem historique avant/après SecureOrderPolicy identique : `9f52e561921f45d85f465c864bbfc9dbdb78054eef7c5e732b9a10091c92a427`. Les assertions finales PostgreSQL vérifient aussi l'absence de mutation après les webhooks. Ceci concerne exclusivement des fixtures synthétiques.

## Corrections et fichiers de cette passe

Nettoyage final : les conteneurs synthétiques de cette mission sont arrêtés ; les ports 4100/4101/5173/5174 sont libres. Les métadonnées et logs sont conservés. Les données tmpfs ne constituent pas une archive restaurable. Aucun conteneur ou processus utilisateur antérieur touché.

Backend, sous drip_backend : src/stripeApiVersion.ts (nouveau), src/runtimeConfiguration.ts, src/productionConfiguration.ts, tests/runtime-staging.test.cjs, tests/runtime-production.test.cjs, commentaire .env.staging.example. Seul changement runtime : contrat explicite de version API ; aucun changement montant, snapshots, autorisations ou moteur de finalisation.

Store/outillage : tools/staging/start.cjs (nouveau cluster Docker, arrêt dédié), backend.cjs (OrderItem historique synthétique), frontend.mjs (CSP offline), final-flow-scenario.cjs (attente 409 historique et assertion de consommation relative à la commande). Ce rapport ; annotation du rapport de compatibilité. Aucun nouveau changement applicatif Store/Checkout dans cette passe. Les fichiers antérieurs offline-stripe* et validate-stripe-offline.cjs sont réutilisés.

Incidents : première invocation non élevée du harness ne trouvait pas docker.exe dans le sandbox ; relance autorisée réussie. Deux premiers passages HTTP ont échoué : attente 401 obsolète pour une commande historique (désormais 409 explicite), puis assertion globale reservedQuantity=0 alors qu'une tentative précédente conservait légitimement sa réservation. Correction des assertions, aucune suppression/réinitialisation des tentatives ; nouveau cluster neuf pour le passage final 9/9. Les anciens logs d'échec sont conservés. Une sonde diagnostique avait lu le mauvais nom de propriété d'environnement synthétique et a échoué avant connexion ; corrigée sans changement applicatif.

## Commandes et suite exacte

Depuis Magic_city_git :

```powershell
node tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-regression-pg18.cjs
node tools/staging/audits/2026-10-10-production-readiness/secure-policy/run-pg18.cjs
node tools/staging/audits/2026-10-10-production-readiness/release-check.cjs
node tools/staging/validate-stripe-offline.cjs
node tools/staging/start.cjs --docker18 --final-flow
```

final-flow-scenario.cjs a été exécuté avec environnement enfant nettoyé, DATABASE_URL du nouveau runtime strictement loopback/magic_staging, STAGING_BACKEND_ROOT et STAGING_RUNTIME explicites ; aucun secret réel hérité. Aucun `prisma migrate deploy` hors des nouveaux conteneurs synthétiques.

Prochaine action : connecter effectivement un navigateur au connecteur Computer Use, puis relancer un nouveau harness Docker avec ces mêmes sources et exécuter les scénarios succès, refus, annulation, expiration, reload, retour Store et panier en navigateur. Ne pas déclarer le parcours complet PASS avant cette preuve. Le binaire rollback Linux doit ensuite être requalifié depuis les présentes sources : les archives précédentes ne contiennent pas le nouveau validateur de version. Inventaire/checksums/backup/restore staging, obligations fournisseurs, alertes PENDING/CRITICAL et autorisations distantes restent séparément requis. Aucun de ces contrôles distants n'est autorisé implicitement.

```text
LOCAL_TESTS=520_PASS
HTTP_VM_FINAL_FLOW=9_OF_9_PASS
POSTGRES18_APPLICATION_VALIDATION=PASS_SYNTHETIC_ONLY
BROWSER_E2E=NOT_EXECUTED_BROWSER_UNAVAILABLE
STRIPE_API_VERSION_COMPATIBILITY=ABSENT_EMPTY_OR_EXACT_SUPPORTED_VERSION
HISTORICAL_SNAPSHOTS_UNCHANGED=PASS_SYNTHETIC
PRODUCTION_STARTUP_BLOCKER_REMOVED=NO
LOCAL_FULL_OFFLINE_E2E_GO=NO
REMOTE_STAGING_DEPLOYMENT_GO=NO
PRODUCTION_DEPLOYMENT_GO=NO
```
