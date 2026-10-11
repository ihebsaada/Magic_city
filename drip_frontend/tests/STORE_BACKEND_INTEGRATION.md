# Store — intégration des lots backend 4, 6, 7 et 8

Validation locale du 4 octobre 2026, Africa/Tunis.
Workspace Magic_city_git, branche fix/store-product-loading.
HEAD conservé : bf60c5fd781655200ff0431a41233841ceb9256a.
Les modifications antérieures de la phase B sont conservées. Aucun commit.

Références lues dans Magic_city_backend_security/drip_backend/tests :
LOT4_IDEMPOTENCY.md, LOT6_RESERVATIONS.md, LOT7_GUEST_ACCESS.md,
LOT8_CATALOGUE.md. Contrats vérifiés également dans productRead.ts,
orderCreation.ts, orderPricing.ts, orderIdempotency.ts, guestOrderAccess.ts,
orderController.ts, et dans les pages Checkout au commit 6b9c8b9.
Backend fix/backend-order-privacy, base d6107db : lecture seule pendant ce travail.

## Rapport PASS/FAIL

| Contrôle | Résultat |
| --- | --- |
| TypeScript application, Vite/configuration et tests | PASS — npm run typecheck |
| Build | PASS — npm run build, 1 717 modules |
| Régressions chargement phase B | PASS — 17 tests |
| Régressions panier/checkout phase B adaptées aux contrats additionnels | PASS — 20 tests |
| Intégration Store/backend simulée | PASS — 41 nouveaux tests |
| Total automatisé | PASS — 78, aucun échec ni test ignoré |
| Lint de tous les fichiers JS/TS modifiés dans cette phase | PASS — aucune erreur, un avertissement Fast Refresh préexistant dans CartContext |
| Lint global | FAIL préexistant — trois erreurs hors fichiers corrigés |
| git diff --check | PASS |
| API réelle de staging / PostgreSQL bout en bout dans cette phase | NON EXÉCUTÉ — API simulée uniquement |
| Navigateur, transfert inter-origines et retour Stripe | NON VALIDÉS dans cette phase |
| Paiement réel, production, commit, push, merge, déploiement | NON EXÉCUTÉS |

Les trois erreurs de lint global sont no-empty-object-type dans
src/components/ui/command.tsx et textarea.tsx, et no-require-imports dans
tailwind.config.ts. Les constructions responsables existent dans bf60c5f ;
ces fichiers n'ont pas été modifiés. Les avertissements SSR useLayoutEffect
des tests, les annonces React Router v7 et la base Browserslist ancienne ne
sont pas des échecs de build/test. Aucune dépendance ajoutée dans cette phase.

Les tests remplacent globalThis.fetch avant les appels et définissent
import.meta.env comme objet vide lors de leur compilation. Les scénarios
utilisent localhost et des identifiants/adresses synthétiques example.invalid.
Aucun appel réseau réel n'est effectué, y compris vers Stripe. React Test
Renderer vérifie aussi les interactions de pagination, panier, confirmation
de montant et wishlist ; il ne constitue pas une validation dans un navigateur.
Le sandbox Windows a empêché esbuild de résoudre ses chemins parents au premier
essai ; tests et build ont ensuite réussi avec l'exécution locale autorisée.

## Catalogue et collections

- Catalogue et grilles de collections utilisent exclusivement
  GET /api/catalog/products, pages de 24, total et hasNext fournis par le serveur.
- Recherche, marque exacte, collection, taille, couleur, disponibilité, bornes
  de prix, promotions et tri sont envoyés au backend. Aucun tri local d'une page
  ne prétend trier le catalogue entier. Les bornes de prix restent celles du
  prix représentatif, conformément au backend, pas celles de toutes les variantes.
- Filtres et tri remettent page à 1 ; état dans l'URL, compatible retour/avance.
  Les champs textuels sont soumis par « Applica », sans requête à chaque frappe.
- Les clés React Query contiennent tous les paramètres. Les pages ne sont pas
  concaténées entre recherches. Annulation des observateurs obsolètes ; une
  ancienne réponse ne peut remplacer la nouvelle grille. Pas de placeholder
  provenant d'une autre page ou d'un autre filtre.
- Couvertures de collection : une carte ; accueil : huit cartes ; recommandations
  de fiche : cinq cartes au maximum, puis exclusion du produit courant et
  affichage de quatre. Aucun endpoint de collection entière utilisé par ces vues.
- Les fonctions historiques getProducts/getProductsByCollection et leurs
  tableaux restent disponibles pour les consommateurs historiques et leurs tests.
- Le backend n'a pas de filtre de nouveautés et déclare isNew=false. Le lien
  historique filter=new affiche cette indisponibilité explicitement, sans filtrer
  seulement une page ni inventer un classement. L'utilisateur peut choisir tous
  les produits ou les promotions. « Best Seller » garde le précédent fallback des
  huit premiers produits ; le backend n'expose pas de classement des ventes.
- Cartes sans description et fiches complètes utilisent des caches distincts.
  La description vide de l'adaptateur de carte ne remplace jamais une fiche.

## Variantes exactes, panier et prix

La fiche historique garde sa description et toutes ses images. Une lecture
additionnelle du catalogue recherche son handle et vérifie ID ET handle exacts,
sans utiliser le premier résultat. Recherche substring : lecture bornée à dix
pages de cent résultats. Absence du produit exact, API indisponible ou recherche
non prise en charge : erreur visible, achat bloqué, aucun fallback de variante.
Un futur endpoint exact de variantes pourrait supprimer ce parcours secondaire ;
aucun contrat backend n'a été changé ici.

Le contenu principal de la fiche se rend avant les variantes et recommandations.
L'ajout reste désactivé tant qu'une variante exacte n'est pas résolue. Taille et
couleur ne sont plus sélectionnées indépendamment sur leurs premières valeurs.
Une combinaison absente, plusieurs correspondances, une option3 non vide ou un
stock invalide sont refusés. Une variante unique sans options reste utilisable.
Le prix, compareAtPrice et le stock affichés à la sélection viennent de cette
variante. Sans sélection, le prix représentatif est indiqué comme indicatif.

Le panier actualise fiche/variantes en no-store avant une NOUVELLE tentative :
options et images invalides retirées, changements de prix/stock signalés,
confirmation supplémentaire exigée. Les quantités sont contrôlées par variante,
y compris les lignes répétées. Les variantes différentes ne se partagent pas
artificiellement une limite de stock global. Sommes calculées en centimes ; les
prix backend ont deux décimales. 0/null : indisponible ; 999 : quantité finie.
Les contraintes transactionnelles backend restent l'arbitre final.

La wishlist conserve ses articles et liens. Pour un produit avec options ou sans
variantes connues, l'ajout passe par la fiche pour choisir une combinaison exacte,
au lieu d'annoncer un succès après un choix silencieux potentiellement inexistant.

Les remises sont prévisualisées puis revérifiées avant la création. Une remise
invalide ou une preview indisponible bloque l'envoi ; une variation du montant
demande confirmation. Le Store ne calcule pas lui-même les règles de remise.
Livraison affichée à zéro dans le récapitulatif, en accord avec le backend :
la politique 9,90 / 99,90 n'est pas activée. Les textes marketing historiques de
livraison ailleurs dans le Store ne constituent pas une activation de frais.

## Tentative persistante et reprise

1. Après actualisation et accord sur le panier, génération crypto.randomUUID().
2. Sauvegarde tabulaire sessionStorage de la clé, demande JSON figée et estimation
   confirmée AVANT toute préparation/création. Stockage indisponible : blocage.
3. POST /order-access/prepare ; jeton et expiresAt enregistrés avant la commande.
4. POST /checkout/intent avec le corps historique inchangé et deux en-têtes :
   Idempotency-Key et Order-Access-Token. Aucun prix ni variantId ajouté au contrat.
5. Après timeout/offline/5xx/réponse perdue, reprise EXPLICITE de la même demande,
   clé et jeton. Pas de nouvel appel de refreshCart, recalcul, renouvellement de
   secret ou lecture du formulaire pour cette reprise.
6. Une promesse commune déduplique les clics concurrents. Aucun retry POST
   automatique. Budget persistant : quatre soumissions au maximum et trois
   préparations au maximum. Dépassement : assistance, aucun nouveau numéro de clé.
7. Réponse connue enregistrée avant navigation. Une reprise connue ne recrée
   pas l'ordre. Erreur locale d'enregistrement après création : reprise avec la
   même clé. Le jeton reste associé à la commande, dans sessionStorage uniquement.
8. Pour un autre achat légitime, action explicite « Inizia un acquisto distinto »
   après résultat connu ou rejet certain ; accès de l'ordre précédent conservé
   avant remplacement de la tentative. Aucune rotation silencieuse.

La date de prepare borne la liaison initiale, pas l'accès après création.
Après une première soumission incertaine, un dépassement de quinze minutes ne
renouvelle donc jamais le jeton. Si seule la préparation a été perdue et aucune
commande envoyée, une nouvelle préparation avec la même clé/demande est sûre.

401 accès, 409 IDEMPOTENCY_CONFLICT et 410 IDEMPOTENCY_EXPIRED bloquent sans
rotation. VARIANT_OUT_OF_STOCK et DISCOUNT_UNAVAILABLE signalent un rejet
transactionnel avant création et permettent une nouvelle confirmation corrigée.
Un 400 initial permet de corriger les données ; un 400 après une réponse incertaine
reste bloquant, car il ne prouve pas l'absence de la première commande. Les autres
409/revues techniques restent conservateurs. 429 demande une attente explicite,
sans retry automatique. L'ancien marqueur « pending », sans clé/payload/secret,
reste bloqué pour vérification manuelle ; il n'est pas converti en nouvel achat.

### Vérification du total créé

Le code actuel de priceDiscount peut ne pas appliquer une remise devenue
inactive/expirée/disparue entre la preview et la transaction, sans toujours
renvoyer DISCOUNT_UNAVAILABLE. Le Store ne modifie pas ce comportement backend.
Il relit GET /orders/:id/min avec le jeton de SA commande, no-store, avant la
redirection. Tout écart avec le montant confirmé demande un accord explicite
sur le total serveur ; les credentials et le corps figé restent inchangés.
Une lecture échouée ou une devise autre que EUR bloque la redirection. Une reprise
relit le même ordre et ne le recrée pas. La vérification est annulée à la sortie
du panier. Cette protection intervient APRÈS création : une commande refusée par
l'utilisateur peut déjà réserver stock/remise et nécessiter réconciliation.

Au retour au Store, le contrôle de paiement utilise le jeton propre à l'ordre.
Absence/401 : aucune requête anonyme de repli, aucune suppression du panier ;
message demandant une récupération vérifiée. Le budget existant de trois lectures
de confirmation est conservé. Aucun appel /pay ou paiement n'est ajouté au Store.

## Sécurité et limites de validation

- Secrets uniquement en en-têtes/sessionStorage, jamais query, fragment,
  redirectUrl, localStorage, cache React Query ou messages de diagnostic.
- Le transport ne retient que les codes d'erreur machine, sans exposer les
  corps d'erreur arbitraires. Fetch et document portent no-referrer.
- Conservation tabulaire : reload et retour dans le même onglet fonctionnent.
  Fermer/effacer le stockage perd les secrets : récupération vérifiée nécessaire.
- Deux onglets ouverts indépendamment peuvent générer deux clés distinctes.
  Pas de coordination distribuée de tentatives entre onglets ni garantie de
  déduplication entre clés différentes. Dupliquer un onglet et sa tentative peut
  réutiliser la même clé, mais ce comportement navigateur reste à tester.
- sessionStorage reste lisible par le JavaScript de l'origine ; CSP/XSS et traces
  APM/extensions/proxy doivent être vérifiées séparément. Le hachage backend ne
  protège pas un jeton volé côté navigateur.
- Pagination offset : pas de snapshot partagé entre pages, conformément au backend.
- Le lookup exact borné peut échouer pour un handle très général ou trop long
  pour search. Il échoue explicitement, sans autoriser un achat approximatif.
- Aucun résultat de latence réseau/images/React de production n'est déduit des
  tests simulés. Aucun test de PostgreSQL/backend relancé dans cette phase Store.

## Dépendances Checkout : non implémentées

Le Store conserve window.location.href=redirectUrl, avec seulement orderId.
Les sessionStorage de Store et Checkout, sur deux origines, ne sont pas partagés.
Aucun token n'est transmis via URL, fragment, popup, postMessage ou pont serveur.
Le Checkout déployé 6b9c8b9 continue ses lectures et paiements sans jeton ; il
fonctionne seulement tant que le backend conserve orderAccessRequired=false.
Ce travail ne supprime donc PAS l'exposition anonyme encore permise par ce mode.

Modifications à autoriser et valider séparément :

1. Choisir un canal de transfert sans secret dans l'URL. La proposition du lot 7
   ouvre Checkout depuis le clic utilisateur, puis handshake postMessage :
   origines exactes autorisées, source égale à la fenêtre attendue, orderId attendu,
   nonce aléatoire et accusé de réception ; jamais targetOrigin="*". Retirer les
   listeners et rompre opener après acquittement. Rien de cela n'est installé ici.
2. Avant choix définitif, tester COOP, mobile, popup bloquée, onglet fermé, messages
   perdus/doublés et reprise. Ne pas affaiblir COOP implicitement. Si impossible,
   faire approuver un pont serveur/cookie sur origine adaptée, séparément.
3. seamless_checkout_flow/src/pages/CheckoutLanding.tsx : attendre et conserver
   le credential associé à orderId avant toute lecture ; envoyer Order-Access-Token
   à GET /orders/:id/min et POST /pay. Garder orderId/sessionId et la même session
   après timeout ; distinguer expiration, revue historique et accès refusé.
4. seamless_checkout_flow/src/pages/OrderConfirmation.tsx : récupérer le token
   conservé et l'envoyer à /pay/confirm ; vérifier l'ordre attendu, pas seulement
   session_id/orderId. Retour dans un autre onglet ou stockage perdu : récupération.
5. Ajouter un module API Checkout commun : timeout, annulation, no-store, erreurs
   machine, retry borné, pas de journalisation de réponses/headers sensibles.
   Le Checkout actuel journalise des corps d'erreur et n'a pas ces protections.
6. Implémenter parcours recovery/redeem côté clients et transport réel vérifié
   côté backend sous autorisation distincte. orderId/email seuls ne donnent pas
   accès. Ne pas insérer le secret reçu par email dans l'URL ou les analytics.
7. Harmoniser ses affichages monétaires avec total en euros et currency du backend.
   OrderConfirmation contient encore un formateur USD/cents pour des détails
   optionnels : corriger cette dépendance avant d'afficher ces détails.
8. Valider entre les deux origines, avec backend isolé et Stripe simulé : retours,
   reload, perte de réponse, isolation ordre A/B, token expiré/révoqué, anciennes
   commandes, JWT Admin et logs hébergeur. Aucun paiement réel requis.
9. Seulement après cette validation et une autorisation distincte, activer la
   protection obligatoire backend. Aucun changement de ce mode dans cette phase.

Déploiement futur : migrations et backend compatibles des lots requis AVANT ce
Store. Le backend de production historique n'expose pas catalogue/prepare : ne
pas déployer le Store seul. Aucun fallback vers une création sans clé/secret ou
une collection entière n'est ajouté pour masquer une API non préparée.
Admin : aucun fichier ni contrat modifié ; il conserve ses endpoints JWT et DTO bruts.

## Fichiers de cette phase

Sous drip_frontend/ exclusivement :

- index.html
- src/types/product.ts
- src/services/request.ts, productService.ts, orderService.ts
- src/lib/productQueries.ts, productVariants.ts (nouveau), cartValidation.ts,
  checkoutAttempt.ts, paidOrderCheck.ts
- src/hooks/useProducts.ts, useCheckout.ts
- src/components/CatalogueBrowser.tsx (nouveau), CollectionCard.tsx,
  home/BestSellersSection.tsx, layout/Layout.tsx
- src/contexts/CartContext.tsx
- src/pages/Catalog.tsx, CollectionDetail.tsx, ProductDetail.tsx, Cart.tsx, Wishlist.tsx
- scripts/run-tests.mjs
- tests/product-loading.test.tsx, checkout-validation.test.tsx,
  store-backend-integration.test.tsx (nouveau), STORE_BACKEND_INTEGRATION.md (nouveau)

package.json/package-lock.json, api.ts, Collections.tsx, home/CollectionsSection.tsx,
QueryFeedback, tsconfig.tests.json et docs/ étaient déjà modifiés/non commités
avant cette phase ; leurs changements antérieurs restent conservés.
Aucune migration dans le Store, aucun fichier backend/Admin/Checkout modifié.

## Prochaines validations et retour arrière

Prochaine autorisation nécessaire : staging complet et adaptation/transfert
Checkout, récupération vérifiée et coordination éventuelle des onglets.
Tester manuellement écran mobile/desktop, recherche soumise, retour/avance des
pages, option absente/rupture, wishlist historique, formulaire modifié après
timeout, stockage bloqué, reload puis reprise, total changé et retour paiement.

Un rollback frontend doit conserver les tentatives et les tokens déjà émis :
ne pas restaurer un parcours créant un ordre neuf après timeout, ni vider le
stockage pour contourner une erreur. Garder l'API catalogue tant que des clients
l'utilisent. Ne pas revenir sur les garanties backend paiement/stock/idempotence
pour corriger une grille. Toute opération de rollback/déploiement attend autorisation.

Aucun service, donnée, variable de production ou paiement réel touché.
Aucun commit, push, merge, switch de branche, déploiement, notification réelle,
activation de frais/protection obligatoire ou tâche de purge/expiration.
La phase s'arrête ici et attend la prochaine autorisation.
