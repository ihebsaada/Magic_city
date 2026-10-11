# Correction autoritative livraison et medias - 5 octobre 2026

La nouvelle regle remplace la politique precedente 9,90 / 99,90 pour les NOUVELLES commandes du parcours staging. Les snapshots existants ne sont pas recalcules. Aucun changement des medias Store, des migrations ou des donnees distantes.

## Rapport

| Controle | Resultat |
| --- | --- |
| Sources des cinq images Mirror comparees a 6b9c8b9 | PASS, identiques ; deux assets locaux presents |
| CSP Checkout local/prefixe | PASS verification de fonction ; seul images.unsplash.com ajoute a img-src |
| CSP Store | INCHANGEE |
| Frontieres livraison 0 / 199,99 / 200 / 250 | PASS |
| Subtotal 200, remise 10%, total 180 | PASS PostgreSQL isole |
| Order, Stripe agrege, faux total client et replay | PASS PostgreSQL isole |
| Snapshot historique sans frais conserve | PASS |
| Checkout scoped et reprise | PASS tests sources avec total 14,90 |
| Backend | PASS 240 (37 contrats + 203 PostgreSQL) |
| Store | PASS 95 |
| Checkout | PASS 72 |
| Cross-app | PASS 20 |
| Total | PASS 427, zero echec de test |
| TypeScript / builds | PASS ; TypeScript tests Checkout relance apres correction replaceAll incompatible avec cible TS |
| Prisma validate | PASS |
| Prisma generate | BLOQUE EPERM query_engine-windows.dll.node |
| Lint et diff --check trois worktrees | PASS |
| Scenarios HTTP historique/final et routage CSP actualise | NON REEXECUTES, ports occupes |
| Navigateur / rendu des images distantes | NON VALIDE, recontrole requis |

validate.cjs termine avec code 1 : Prisma generate verrouille et premier controle TS du test media corrige ensuite. Ce resultat n'est pas un PASS global. Les 427 tests de cette execution passent. La relance separee TypeScript/tests Checkout termine avec code 0.

Le staging manuel garde les ports : backend 4100/4101 PID 28836, Store 5173 PID 17396, Checkout 5174 PID 26448, parent lanceur PID 19340. Aucun processus ferme de force. Le processus deja charge ne prouve pas les nouvelles reponses HTTP. Les anciens resultats HTTP restent des preuves anterieures.

## Regle et exemples

Backend calcule le subtotal depuis les variantes et la remise depuis les donnees serveur. Frais 5 EUR lorsque subtotal marchandises avant remise <200 EUR, sinon zero. Le frontend estime la meme regle. Une commande vide reste interdite ; le test subtotal zero verifie uniquement la fonction de frais.

stage-001 M/Blue avec STAGE10 : 11 - 1,10 + 5 = 14,90 EUR ; Stripe recoit 1490 centimes EUR dans une seule ligne agregee sans composition/nom produit/variante/SKU/image. Subtotal 200 avec remise 20 donne 180, sans frais. Les demandes idempotentes deja enregistrees ne sont pas repric?es.

## Fichiers de cette correction

- Store : drip_frontend/src/lib/navigationHandoff.ts ; tests/navigation-handoff.test.ts.
- Backend : src/services/shipping.ts ; tests/navigation.integration.test.cjs ; NAVIGATION_HANDOFF_STAGING.md.
- Checkout : tests/navigation-handoff.test.ts ; tests/mirror-parity.test.tsx. Home et ses images restent inchanges.
- Outillage : tools/staging/frontend.mjs ; common-origin-tests.cjs ; final-flow-scenario.cjs ; README.md ; present rapport. VALIDATION_RESULTS.json genere conserve les resultats de l'execution complete.

## Reprise restante

Arreter le lanceur manuel avec Ctrl+C et conserver son run/stockages. Apres verification des quatre ports libres :

~~~powershell
node tools/staging/validate.cjs
node tools/staging/start.cjs --verify
node tools/staging/start.cjs --final-flow --verify
node tools/staging/start.cjs --final-flow
~~~

Recontroler en navigateur les cinq images Mirror, le meme onglet Store vers Checkout, total 14,90 puis confirmation scoped, seuil 200 avant remise, reload/reponse perdue et conservation du panier modifie. Ne pas utiliser une nouvelle base pour pretendre reprendre une tentative ancienne.

~~~text
MIRROR_5_IMAGES_SOURCE_PARITY=PASS
MIRROR_MEDIA_CSP=PASS source/fonction; HTTP et navigateur a revalider
STORE_LOCAL_MISSING_MEDIA_ACTION=NONE
SHIPPING_FEE=5.00_EUR
FREE_SHIPPING_THRESHOLD=200.00_EUR
SHIPPING_THRESHOLD_BASIS=MERCHANDISE_SUBTOTAL_BEFORE_DISCOUNT
SHIPPING_BACKEND_AUTHORITY=PASS
ORDER_TOTAL_CORRECT=PASS
CHECKOUT_TOTAL_CORRECT=PASS tests simules; navigateur a revalider
STRIPE_TOTAL_CORRECT=PASS Stripe simule local
STORE_TESTS=95 PASS
CHECKOUT_TESTS=72 PASS
BACKEND_TESTS=240 PASS
CROSS_APP_TESTS=20 PASS
TOTAL_TESTS=427 PASS
TYPESCRIPT=PASS
BUILDS=PASS
DIFF_CHECK=PASS
BROWSER_RECHECK_REQUIRED=YES
READY_FOR_CONTROLLED_COMMIT=NO
READY_FOR_STAGING_DEPLOY=NO
~~~

Indexes Git vides. Aucun commit, push, deploy, Stripe reel, connexion Render/production, migration nouvelle ou suppression de cluster/tentative/stockage. STOP en attente de liberation du staging manuel.

## Alignement des textes visibles de livraison

Les anciennes mentions ACTIVE_DELIVERY_TIME_COPY (24-48h, express 24h, 5-7 jours et pronta consegna) sont remplacees par une reception estimee en 7-10 jours, en italien, sans modification de layout. Fichiers : FAQ.tsx, ProductDetail.tsx, HelpCenterSection.tsx, ServicesSection.tsx, HeroSection.tsx. Les seuils visibles sont alignes a 200 EUR dans FAQ, ProductDetail, TopBar et ScrollingPromoBar. Les delais de retour 14/30 jours et horaires assistance sont hors politique de reception et restent inchanges, comme tous les delais techniques. Aucune ancienne reference shipping 9.90/99.90 dans src Store. proposedShipping backend reste une fonction ancienne non appelee, non modifiee dans cette passe Store.

DELIVERY_TIME_POLICY=ESTIMATED_7_TO_10_DAYS
VISIBLE_DELIVERY_TIME_COPY_ALIGNED=YES
OLD_ACTIVE_DELIVERY_TIME_REFERENCES=NONE

Tests Store precedemment relances : 96 PASS. Ces dernieres modifications sont uniquement des textes. TypeScript/build relances ; aucun commit/push/deploy. La validation globale bloquee decrite plus haut reste distincte.
