# Playwright — E2E réel hors ligne, 10 octobre 2026

## Verdict

**LOCAL_BROWSER_E2E_GO=YES pour la matrice locale ci-dessous.** Un véritable navigateur Chromium a exécuté les pages et leurs handlers, avec le backend et PostgreSQL locaux et Stripe simulé. Ce résultat remplace uniquement le blocage « navigateur non exécuté » du rapport FULL_OFFLINE_E2E_VALIDATION.md ; il ne certifie pas Stripe, Render, Netlify ni un déploiement.

REMOTE_STAGING_DEPLOYMENT_GO=NO ; PRODUCTION_DEPLOYMENT_GO=NO. Aucun accès distant, secret réel, commit/index/push/déploiement ou modification des permissions distantes. PRODUCTION_LEGACY_ACCESS_REVIEW_REQUIRED reste actif ; aucune application ni commande historique modifiée. docs/ et tous les diffs antérieurs sont conservés.

## Navigateur et infrastructure réellement utilisés

- Playwright **1.62.1**, déjà installé dans le runtime local `C:/Users/hp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright` ; aucune dépendance installée.
- **Microsoft Edge Chromium 154.0.4258.62**, exécutable existant `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`, mode headless. Chrome est également présent ; aucun Chromium téléchargé par Playwright n'a été trouvé dans le cache utilisateur standard. Chrome n'a pas été utilisé.
- Contextes navigateur neufs, stockage vide propre à chaque scénario ; aucun profil personnel, cookie ou grant existant réutilisé. Service workers bloqués, WebSockets fermés, background networking/sync/component update désactivés et résolution externe refusée par les arguments Chromium.
- Nouveaux conteneurs Docker synthétiques, PostgreSQL **18.6** vérifié ; 18 migrations appliquées exclusivement à leurs bases neuves. Aucun cluster utilisateur réutilisé. Loopback uniquement : Store 5173, Checkout 5174, faux Stripe 4101, API 4100, port PostgreSQL dynamique.
- Harness `start.cjs --docker18 --final-flow` et fournisseur local existants réutilisés. Les scénarios de refus/annulation/expiration ont été ajoutés au simulateur seulement ; ils ne changent pas le moteur commercial.

Le runner `tools/staging/playwright-offline.cjs` valide le runtime synthétique, la version 18.6 et l'URI locale avant lecture DB. Les requêtes navigateur ne sont autorisées que vers les quatre origines loopback exactes ; toute autre requête est abortée avant envoi. Les réponses API, tokens et URL de paiement ne sont pas exportés. Pas de trace, HAR, vidéo, cookies ou dump de stockage.

## Scénarios exécutés : 7 groupes PASS, 0 FAIL final

| Groupe navigateur | Preuve / résultat |
| --- | --- |
| Store → panier → Checkout → faux Stripe → confirmation → Store | Clics réels depuis fiche produit ; STAGE10 ; total backend 14,90 EUR, montant affiché Checkout puis faux Stripe 14.90 EUR, confirmation 14,90 € ; une seule page navigateur, navigation same-tab ; PASS |
| Double clic, reload et confirmation répétée | Double clic checkout puis paiement ; une PaymentAttempt et une finalisation ; reload Landing puis confirmation ; aucun doublon commercial ; PASS |
| Retour Store et panier exact payé | Bouton Continua a fare acquisti revient à l'origine Store configurée ; panier local effectivement vide seulement après backend PAID ; zéro article ; PASS |
| Refus et annulation | Clic refus : message simulé, commande PENDING et aucune finalisation ; clic annuler : retour Landing ; back/reload retrouve le même paiement ; panier conservé ; PASS |
| Expiration | Clic expirer : session fournisseur expired, événement signé ; tentative de payer ensuite refusée ; aucune commande PAID, aucune finalisation, panier conservé ; PASS |
| Panier édité après création de commande | Ajout réel d'un autre produit depuis le Store avant paiement ; confirmation PAID ; retour Store conserve la nouvelle ligne ; PASS |
| Historique et isolation | Landing historique affiche une erreur et aucun bouton Paga ora ; lecture backend sans droit refusée ; hash Order/OrderItem historique identique avant/après toute la matrice ; PASS |
| Responsive, inclus dans les 7 groupes | Home, Catalogo, Collezioni et produits de collection : 320/375/390/430/1280 px ; grilles mobiles deux colonnes et aucun débordement horizontal ; confirmation sans débordement aux quatre largeurs mobiles ; PASS |

Les lignes détaillent les assertions regroupées par le runner : ce tableau n'ajoute pas des tests au total de sept groupes. Le maintien du panier avant paiement et après échec est observé dans les groupes négatifs ; la protection de révision est observée par l'ajout d'une nouvelle ligne avant succès. L'UI panier peut encore afficher le panneau de reprise de la tentative réussie avec **0 articoli** : son texte « panier vide » n'est pas le critère de vidage, vérifié dans le stockage et l'UI.

## Réseau et preuves expurgées

Dernier passage : `release-review/playwright/run-1791648401912/RESULTS.json`.

- 5052 requêtes autorisées vers les services loopback.
- 40 tentatives de ressources externes **bloquées avant envoi** ; zéro réponse externe.
- 50 WebSockets fermés par le runner (y compris HMR local).
- Aucune requête applicative autorisée vers Stripe réel, Render ou un autre service externe. Ce contrôle Playwright n'est pas une capture de tout le trafic du système d'exploitation.

Captures locales, sans barre d'adresse ni identifiant de paiement : `catalog-320.png`, `catalog-375.png`, `catalog-390.png`, `catalog-430.png`, `catalog-1280.png`, `confirmation-redacted.png`, `confirmation-mobile-redacted.png`, dans le dossier ci-dessus. Identifiant de commande masqué, inputs masqués ; données de catalogue exclusivement fictives. Les captures de confirmation desktop/mobile et catalogue 320 ont été inspectées visuellement. Pas de validation visuelle absolue de toutes les pages.

Les logos/médias dépendant d'origines distantes restent absents dans cette simulation réseau fermée ; leur rendu distant n'est pas testé. Les fichiers générés restent ignorés et hors index.

## Corrections locales et incidents

Fichiers de cette passe :

1. `tools/staging/backend.cjs` : boutons et endpoint synthétiques `decline/cancel/expire`, mêmes contrôles d'origine et de preuve de page que complete ; refus de régression d'une session déjà payée ; expiration modifie seulement l'état du faux fournisseur, puis émet un webhook signé vers le vrai handler applicatif. Aucune écriture Order/OrderItem directe ajoutée.
2. `tools/staging/playwright-offline.cjs` : nouveau runner navigateur, contextes neufs, allowlist réseau, assertions UI/DB, captures masquées et résultats sans credentials.
3. Ce rapport et annotation du rapport E2E précédent.

Aucun changement applicatif Backend/Store/Checkout nécessaire. Les premiers essais ont échoué dans le runner : Chromium avait libéré le corps de réponse lors d'une navigation cross-origin, même avec un listener de réponse ; le test lit désormais l'identité via l'URL de navigation réelle, sans exporter le fragment, puis vérifie les faits en DB synthétique. Une autre assertion attendait à tort le titre « panier vide » malgré le panneau de reprise : remplacée par panier réellement vide et 0 articoli, sans modification du produit. Les résultats d'échec ne sont pas présentés comme PASS. Les tentatives n'ont pas été purgées ou réinitialisées pour réussir ; de nouveaux clusters ont été créés pour les passages propres. Le dernier passage complet, incluant la confirmation mobile, est PASS.

## Régressions relancées

| Validation de cette passe | Résultat |
| --- | --- |
| Backend non-DB/mock/HTTP | 53 PASS |
| Store | 118 PASS |
| Checkout | 92 PASS |
| Cross-app VM | 20 PASS |
| Simulateur déterministe offline | 9 PASS |
| Total suites non-DB/offline relancées | **292 PASS** |
| Parcours HTTP/VM final sur un autre cluster neuf après correction du simulateur | **9/9 groupes PASS** |
| Playwright réel | **7/7 groupes PASS** |
| TypeScript trois projets, builds, Prisma validate | PASS |
| Git diff/cached checks trois worktrees | PASS ; index vides |

Les 228 tests PostgreSQL détaillés dans FULL_OFFLINE_E2E_VALIDATION.md restent une preuve antérieure de la même logique applicative ; ils n'ont pas été relancés dans cette passe d'outillage. Le navigateur a utilisé une vraie DB PostgreSQL migrée et vérifié finalisation, tentatives, états, montants et conservation historique. Ne pas additionner les 520 antérieurs aux 292 pour inventer des scénarios uniques.

Commandes exécutées depuis Magic_city_git :

```powershell
node tools/staging/start.cjs --docker18 --final-flow
node tools/staging/playwright-offline.cjs <chemin-du-NOUVEAU-runtime-synthetique>
node tools/staging/validate-stripe-offline.cjs
node tools/staging/audits/2026-10-10-production-readiness/release-check.cjs
node tools/staging/start.cjs --docker18 --final-flow --verify
```

Les conteneurs et navigateurs de cette mission sont arrêtés ; les ports locaux sont libérés. Les métadonnées/captures restent conservées, les données tmpfs ne sont pas des sauvegardes restaurables. Aucun processus utilisateur ni ancien cluster touché.

## Limites et prochaines étapes

Non exécutés : navigateur Firefox/WebKit/Chrome, appareil mobile physique/tactile, rendu des ressources externes, Stripe distant TEST/LIVE, 3DS/SCA réel, paiement bancaire asynchrone fournisseur, sessions fournisseur réelles, contexte Linux déployé et mesures de trafic global OS. Les callbacks doubles/tardifs sont relancés dans les 9 groupes HTTP/VM ; LIVE/TEST/signatures adversariales sont couverts par les suites existantes, pas par une visite de Stripe réel.

Prochaine action exacte : revue humaine de `backend.cjs`, `playwright-offline.cjs` et de ce rapport ; ensuite autoriser séparément les contrôles staging READ ONLY et le backup/restore. Inventaire/checksums/obligations historiques, monitoring des receipts PENDING/CRITICAL et binaire rollback Linux policy-aware restent des gates de release. Ne pas déployer, retirer le stop production ou modifier une configuration distante sur la seule base de cette simulation.

```text
BROWSER=MICROSOFT_EDGE_CHROMIUM_154.0.4258.62_HEADLESS
PLAYWRIGHT=1.62.1_PREINSTALLED
BROWSER_SCENARIO_GROUPS=7_PASS_0_FAIL_FINAL
HTTP_VM_GROUPS=9_PASS
REGRESSION_TESTS_RERUN=292_PASS
EXTERNAL_BROWSER_RESPONSES=0
HISTORICAL_ORDER_ITEM_SNAPSHOTS_UNCHANGED=YES_SYNTHETIC
PRODUCTION_STARTUP_BLOCKER_REMOVED=NO
LOCAL_BROWSER_E2E_GO=YES
REMOTE_STAGING_DEPLOYMENT_GO=NO
PRODUCTION_DEPLOYMENT_GO=NO
```
