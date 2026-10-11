# Phase C — accès automatique sur origine commune

Validation locale du 4 octobre 2026. Phases D à F non commencées.

| Contrôle | Résultat |
| --- | --- |
| TypeScript et builds Backend, Store et Checkout ; Prisma generate/validate | PASS |
| Contrats backend et PostgreSQL réel isolé | PASS — 29 + 190 tests |
| Store et Checkout, suites historiques | PASS — 83 + 51 tests |
| Transfert et accès initial simulés | PASS — 13 tests |
| Total automatisé ci-dessus | PASS — 366 |
| Scénarios staging HTTP, historiques conservés | PASS — 25 |
| Routage commun et ressources HTTP | PASS — 6 |
| Transfert désactivé dans quatre bundles de production | PASS |
| Restriction du simulateur dans les bundles de production | PASS |
| Lint des fichiers concernés | PASS |
| Parcours navigateur desktop/mobile | NON VALIDÉ |

Les tests de transfert utilisent les sources réelles compilées, un stockage et
une fenêtre simulés. Le scénario staging utilise l'API réelle et PostgreSQL
synthétique. Ces contrôles ne valident pas les clics ou le rendu navigateur.

## Protocole et périmètre

Uniquement dans le serveur de développement MODE=staging, DEV=true, PROD=false,
avec VITE_COMMON_CHECKOUT_ENABLED=true et origine exacte
http://127.0.0.1:5173, le Store publie une association sessionStorage par commande.
Elle contient la commande, son jeton existant et sa clé de tentative. Publication
après création connue et vérification/accord sur le total, avant navigation dans
le même onglet vers /checkout/checkout-landing?orderId=REFERENCE_PUBLIQUE.
Une association différente ne peut pas être écrasée. La demande figée reste intacte.

Le Checkout préfixé exige également basename=/checkout/. Il vérifie l'identifiant
exact et la structure de l'association, puis consulte /orders/:id/min avec
Order-Access-Token. Aucun accès n'est accordé sur l'identifiant seul. Il ne marque
le credential autorisé qu'après réponse backend correspondante en EUR et contrôle
des changements concurrents du stockage et de la session existante.

Jeton absent, invalide, expiré, révoqué, réponse d'une autre commande ou conflit
local : blocage explicite. La reprise relit la même association ; elle ne prépare
pas de nouveau jeton et ne crée aucune commande. Une session Stripe déjà connue
et les budgets existants sont conservés. Annulation de navigation : pas d'adoption
tardive du credential. Stockage inaccessible : blocage avant navigation.

Le Checkout 5174 conserve son appairage manuel. Les builds de production restent
sur ce parcours historique. Aucun protocole backend, CORS, réservation, paiement,
webhook, confirmation ou suppression du panier n'est modifié. Le bouton de paiement
de l'instance commune est désactivé : la phase C valide exclusivement l'accès initial.
Les destinations Stripe et les retours historiques restent sur 5174.

Le préfixe n'est pas une frontière de sécurité : les deux applications ont accès
au stockage de la même origine. Une XSS peut voler une capacité porteuse. Aucun
jeton ne figure dans une URL, un cache de requête ou un diagnostic ajouté.
Fermer l'onglet peut perdre le stockage ; aucune récupération automatique n'est
promise. Le transport email vérifié reste non configuré.

## Exécution et validations manuelles restantes

Depuis Magic_city_git :

```powershell
node tools/staging/validate.cjs
node tools/staging/common-access-production.mjs
node tools/staging/start.cjs --verify
node tools/staging/start.cjs
```

Le dernier lanceur reste ouvert jusqu'à Ctrl+C. Dernier cluster validé :
.runtime/run-1791128188157, arrêté et conservé. Tous les clusters antérieurs,
données et tentatives sont conservés. Pour un essai manuel propre, utiliser un
nouveau run et un profil de staging neuf, sans effacer les stockages existants.

1. Store http://127.0.0.1:5173/catalog : choisir stage-001 M/Blue, 11,00 EUR,
   une unité et STAGE10 ; confirmer le total 9,90 EUR.
2. Procéder au paiement : même onglet vers /checkout/checkout-landing avec seulement
   orderId public. Aucun panneau d'appairage. La commande et le total doivent
   s'afficher après vérification backend, sans création d'une autre commande.
3. Recharger, revenir au Store puis reprendre : même tentative et même accès.
   Tester double clic, réseau interrompu et réponse perdue ; aucune rotation.
4. Sur des fixtures dédiées, vérifier absence d'association, commande différente,
   grant expiré/révoqué et conflit : blocage explicite, aucun repli anonyme.
   Ne pas copier de token dans la console ou une capture pour forcer le parcours.
5. Vérifier le bouton de paiement désactivé sur l'instance commune. Le paiement
   et la confirmation automatiques attendent une autorisation de phase D.
6. Vérifier séparément le Checkout historique 5174 et son appairage manuel.
   Contrôler desktop/viewport mobile, reload, retour/avance, Network et console.
   Aucun secret dans URL, referer ou journaux. Un viewport mobile ne valide pas iOS.

## Fichiers de cette phase

Store : src/lib/commonCheckout.ts (nouveau), src/pages/Cart.tsx.
Checkout : src/lib/secureCheckout.ts, src/pages/CheckoutLanding.tsx.
Sous tools/staging/ : start.cjs, scenario.cjs, common-origin-tests.cjs,
common-origin-validation.cjs, validate.cjs, common-access-tests.cjs (nouveau),
common-access-production.mjs (nouveau), README.md, présent rapport,
COMMON_ACCESS_PRODUCTION_RESULTS.json (nouveau), STAGING_RESULTS.json,
COMMON_ORIGIN_RESULTS.json, COMMON_BUILD_RESULTS.json, VALIDATION_RESULTS.json,
PAYMENT_URL_RESULTS.json.

Aucune migration ni dépendance ajoutée. Les travaux précédents sont conservés.
Aucun changement de branche, commit, push, merge, déploiement, paiement réel,
production, email réel, frais de livraison ou protection obligatoire activée.
Le benchmark backend réexécuté par le validateur est restauré à l'identique.

Résultat : PASS automatisé ; navigateur NON VALIDÉ. Aucun feu vert de production.
Toute phase D ou correction supplémentaire attend une nouvelle autorisation.
