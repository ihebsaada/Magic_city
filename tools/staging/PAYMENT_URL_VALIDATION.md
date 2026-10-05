# Checkout — correction limitée de l'URL de paiement

Validation locale du 4 octobre 2026, Africa/Tunis.

## Rapport PASS/FAIL

| Contrôle | Résultat |
| --- | --- |
| Checkout TypeScript application/configuration/tests | PASS — npm run typecheck |
| Checkout build de production | PASS — npm run build, 1 675 modules |
| Tests Checkout existants | PASS — 23 |
| Tests URL additionnels | PASS — 28 exécutions : 4 tests dans 7 configurations |
| Total Checkout exécuté | PASS — 51, zéro échec/test ignoré |
| Deux vrais bundles Vite de production, modes production et staging | PASS — simulateur configuré refusé dans les deux |
| Lint des fichiers JS/TS modifiés | PASS — zéro erreur |
| Staging réel HTTP / PostgreSQL synthétique / Stripe simulé | PASS — 20 vérifications groupées |
| git diff --check Store / Checkout | PASS |
| Parcours desktop/mobile dans un navigateur | NON VALIDÉ — apps=[] et browsers=[] |

Les quatre tests URL sont exécutés dans sept contextes : staging local valide,
configuration absente, configuration incorrecte, production, build de production
avec mode staging, mode development, et origine Checkout incorrecte.
Les 28 exécutions ne représentent pas 28 parcours navigateur.

## Correction

Production : seule l'origine HTTPS https://checkout.stripe.com est acceptée.
Les ports différents, sous-domaines, domaines ressemblants, identifiants
username/password, fragments et URL invalides sont refusés.

Simulation : exige simultanément MODE=staging, DEV=true, PROD=false,
VITE_LOCAL_STRIPE_ORIGIN=http://127.0.0.1:4101 et une page sur l'origine exacte
http://127.0.0.1:5174. Le lanceur configure cette variable uniquement dans le
processus Checkout. Aucun .env applicatif ou de production modifié.
Une configuration absente, incorrecte ou présente dans un bundle de production
ne permet pas d'utiliser le simulateur. Même un build --mode staging le refuse :
utiliser le serveur Vite du lanceur pour le parcours local.

L'origine autorisée n'est jamais déduite d'une query, d'un message, de la réponse
API ni d'une saisie. Le contrôle du sessionId, l'interdiction de remplacer une
session connue, le jeton scoped et l'identité de commande sont conservés.
Le sessionId et l'URL validés sont persistés avant que pay() retourne à la page,
laquelle navigue seulement ensuite. Une URL refusée ne sauvegarde pas de session.

## Staging démontré

Le lanceur injecte effectivement les valeurs attendues dans le module servi par
Vite, vérifiées via HTTP. Tous les anciens scénarios sont conservés.
Le nouveau scénario exécute le véritable module secureCheckout.ts compilé dans
un contexte Node avec window/sessionStorage simulés, contre le backend HTTP réel :
préparation du credential, approbation authentifiée, rédemption, /pay, sauvegarde
du sessionId, réutilisation de la même session, page locale, paiement simulé,
webhook signé et confirmation. Total EUR 9,90, finalisation unique et compteur de
remise vérifiés dans PostgreSQL. Aucun fetch public ou compte Stripe utilisé.
Ce contexte Node ne valide ni clic React, ni stockage réel entre onglets.

Dernier cluster synthétique : .runtime/run-1791109242233, arrêté et conservé.
Les clusters, tentatives et fichiers privés antérieurs sont conservés.
Les résultats sans credentials sont dans STAGING_RESULTS.json et
PAYMENT_URL_RESULTS.json. Les logs de staging ne contiennent pas les jetons
synthétiques générés. Aucun nouveau schéma ou migration métier.

## Fichiers de cette correction

Checkout, sur fix/checkout-guest-access :
- src/lib/secureCheckout.ts
- tests/payment-url.test.ts
- tests/payment-url-entry.ts — entrée minimale pour l'audit des bundles Vite
- scripts/run-tests.mjs

Outillage dans le workspace Store :
- tools/staging/start.cjs
- tools/staging/scenario.cjs
- tools/staging/payment-url-validation.mjs
- tools/staging/README.md
- tools/staging/STAGING_RESULTS.json
- tools/staging/PAYMENT_URL_RESULTS.json
- tools/staging/PAYMENT_URL_VALIDATION.md

Aucun fichier métier Store, backend ou Admin modifié. Branches/HEAD conservés :
Store fix/store-product-loading@bf60c5f,
backend fix/backend-order-privacy@d6107db,
Checkout fix/checkout-guest-access@6b9c8b9.
Les changements non commités des phases précédentes restent présents.

## Démarrage et vérifications manuelles restantes

Depuis Magic_city_git :

```powershell
node tools/staging/payment-url-validation.mjs
node tools/staging/start.cjs --verify
node tools/staging/start.cjs
```

Depuis Magic_city_checkout_security/seamless_checkout_flow :

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

Suivre les étapes 1–10 du [guide manuel](README.md) : Store
http://127.0.0.1:5173/catalog, Checkout http://127.0.0.1:5174,
simulateur http://127.0.0.1:4101. Choisir M/Blue à 11,00 EUR et STAGE10 :
total 9,90 EUR. Comparer et approuver l'appairage, cliquer Payer, puis le bouton
SIMULÉ local ; vérifier confirmation et panier Store vidé uniquement après PAID.
Tester aussi double clic, interruption avant navigation, reload, onglet fermé,
perte de connexion, mauvais appairage et retour d'une autre session.
Ne jamais injecter d'état paid ou de credential pour contourner un échec.

Desktop et viewport mobile restent à exécuter. Safari iOS / Chrome Android réels
demandent un environnement local adapté : ce lanceur écoute seulement loopback,
sans exposition LAN autorisée. Ne pas assouplir COOP/CSP ou élargir les origines.

## Limites et arrêt

Le blocage URL est corrigé et validé automatiquement ; le parcours UI complet
reste NON VALIDÉ dans un navigateur. Aucun feu vert de production.
Builds de production interdisent intentionnellement le paiement simulé.
Les limites antérieures d'accès invité compatible, récupération email absente,
CSP/XSS et logs d'hébergement restent inchangées.

Un premier contrôle lint a signalé le helper create() auparavant inutilisé dans
scenario.cjs ; son utilisation par le nouveau scénario résout ce signalement.
Une erreur initiale de quoting PowerShell a interrompu le script avant écriture ;
la correction a ensuite été appliquée par un script local. Aucun échec final.
Browserslist ancien et avertissements LF/CRLF restent non bloquants.

Aucun paiement réel, production, commit, push, merge, déploiement, activation
de protection obligatoire, frais de livraison ou notification réelle.
Toute autre modification attend une nouvelle autorisation.
