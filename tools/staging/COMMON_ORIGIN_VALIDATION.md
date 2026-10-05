# Phase B — origine commune locale

Validation locale du 4 octobre 2026. Phases C à F non commencées.

| Contrôle | Résultat |
| --- | --- |
| Checkout TypeScript application/configuration/tests | PASS |
| Checkout production build, base par défaut | PASS |
| Checkout tests | PASS — 51 |
| Build Store et build Checkout /checkout/ séparés | PASS |
| Store tests | PASS — 83 |
| Scénarios PostgreSQL synthétique historiques | PASS — 24 |
| Origine commune : contrôles HTTP | PASS — 6 |
| Deux bundles de production refusent le simulateur configuré | PASS |
| Lint des fichiers modifiés et git diff --check | PASS |
| Navigateur desktop/mobile | NON VALIDÉ — apps=[] et browsers=[] |
| Appairage/paiement automatique sur origine commune | NON IMPLÉMENTÉ, hors phase B |

## Configuration et protections

App.tsx reçoit VITE_ROUTER_BASENAME, avec / par défaut. Le lanceur seul configure
l'instance préfixée à /checkout/. Aucune variable de production modifiée.
Le serveur Vite Store sur 5173 monte un deuxième serveur Vite en middleware,
avec root Checkout distinct, base /checkout/, cache distinct et HMR désactivé
pour cette seule instance afin d'éviter une collision websocket. Store et
Checkout historique 5174 conservent leurs serveurs et configurations.

Le montage précède le fallback SPA Store. /checkout redirige vers /checkout/ ;
/checkout/* est traité par Checkout. Les entrées /src et /checkout/src, dépendances,
CSS, client Vite et fichiers publics sont distincts. Les assets absents /assets/*
retournent 404 au lieu d'un HTML Store. Une route SPA inconnue retourne son HTML
de bootstrap avec HTTP 200 : l'affichage NotFound React reste à vérifier en
navigateur. Ce comportement n'est pas présenté comme une 404 HTTP.

CSP et no-referrer conservés, aucune origine supplémentaire autorisée côté
backend/simulateur. Fichiers privés existants .runtime refusés dans les deux
namespaces. Aucun secret dans une URL, aucun changement de transfert ou stockage.
Même origine implique que les scripts peuvent accéder au stockage de l'origine :
le préfixe est une séparation de routage, pas une frontière de sécurité.

Les liens React Router vers / et /cart sont interprétés avec basename :
/checkout/ et /checkout/cart. Les liens de confirmation interne restent préfixés
par le routeur. Torna al carrello Store est une sortie explicite vers le Store.
Les redirections Stripe et le simulateur restent sur les destinations historiques
5174, volontairement. Les guards de paiement et du pont continuent à exiger 5174 :
la nouvelle instance est une préparation de routage, pas un nouveau parcours payé.

## Résultats et portée

Six contrôles HTTP vérifient : HTML distinct, accès direct et reload des routes,
basename/configuration et liens internes, modules/CSS/static bag.png identique à
5174 et logo Store, assets 404, fichier privé réel refusé, configuration API
historique. Ils vérifient les réponses et modules servis, pas le rendu navigateur.

Les 24 scénarios de phase A restent PASS, sur PostgreSQL réel isolé et Stripe
simulé. Dernier cluster .runtime/run-1791126161929 arrêté et conservé.
Les builds séparés sont dans .runtime/common-build-*, sans remplacement des
artefacts ou données existants. Aucun backend métier modifié, aucune migration.

Les premiers contrôles ont détecté le montage placé après le fallback Store,
corrigé avant validation finale. Deux assertions de test ont été ajustées :
Vite injecte le basename dans import.meta.env en développement ; le test privé
doit viser le fichier existant du run, et non un chemin inexistant avec fallback
SPA. Le statut 404 des assets absents a été ajouté au seul outillage staging.
Aucun échec final. Avertissements Browserslist et LF/CRLF non bloquants.

## Démarrage et vérifications manuelles

Depuis Magic_city_git :

```powershell
node tools/staging/common-origin-validation.cjs
node tools/staging/start.cjs --verify
node tools/staging/start.cjs
```

Le dernier reste ouvert jusqu'à Ctrl+C. Store http://127.0.0.1:5173/catalog,
Checkout nouveau http://127.0.0.1:5173/checkout/,
Landing http://127.0.0.1:5173/checkout/checkout-landing,
confirmation http://127.0.0.1:5173/checkout/order-confirmation.
Checkout historique http://127.0.0.1:5174/checkout-landing.
API 4100 et simulateur 4101 inchangés.

Tester Chrome/Edge/Firefox desktop et viewport mobile : chargement de chaque
page, reload direct, liens Home/Cart du Checkout restant sous /checkout/, retour
Store explicite, CSS/images, console sans erreur de module et route inconnue
affichant NotFound Checkout. Vérifier Network : modules Checkout sous /checkout/,
modules Store hors préfixe, aucune ressource privée ni connexion distante.
Tester 5174 en parallèle. Ne pas vider les stockages ou copier les tokens pour
forcer l'accès de la nouvelle instance. Confirmation sans session connue doit
afficher un blocage, pas annoncer PAID. Le paiement réel à origine commune
attend les phases suivantes ; les refus de sécurité actuels doivent rester.

Safari iOS/Chrome Android réels demandent un harness adapté : aucune exposition
LAN autorisée. Aucun navigateur accessible ici ; rendu, clics et reload React
restent NON VALIDÉS malgré les vérifications HTTP.

## Liste exacte des fichiers de cette phase

Checkout :
- seamless_checkout_flow/src/App.tsx

Workspace Store :
- tools/staging/frontend.mjs
- tools/staging/start.cjs
- tools/staging/common-origin-tests.cjs
- tools/staging/common-origin-validation.cjs
- tools/staging/COMMON_ORIGIN_RESULTS.json
- tools/staging/COMMON_BUILD_RESULTS.json
- tools/staging/STAGING_RESULTS.json
- tools/staging/PAYMENT_URL_RESULTS.json
- tools/staging/README.md
- tools/staging/COMMON_ORIGIN_VALIDATION.md

Les logs/builds/clusters sous .runtime sont ignorés et conservés.
Branches inchangées, travaux précédents préservés. Aucun paiement réel, commit,
push, merge, déploiement, domaine public, Netlify, activation de frais/protection
ou email réel. L'Admin reste inchangé. Toute phase suivante attend autorisation.
