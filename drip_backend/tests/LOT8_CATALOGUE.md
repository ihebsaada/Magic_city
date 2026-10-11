# Lot 8 — requêtes produits et catalogue

Validation locale du 4 octobre 2026 (Africa/Tunis). Worktree Magic_city_backend_security, branche fix/backend-order-privacy, HEAD inchangé d6107db9221ab746867639c4b99f8c6b2ee8397e. Les lots 1 à 7 sont conservés.

## Rapport PASS/FAIL

| Contrôle | Résultat |
| --- | --- |
| TypeScript : npm run typecheck | PASS |
| Build : npm run build, également exécuté par les commandes de tests | PASS |
| Prisma format, generate, validate avec URL synthétique localhost | PASS |
| Contrats synthétiques existants | PASS — 29 |
| PostgreSQL : idempotence lot 4 | PASS — 16 |
| PostgreSQL : paiements lot 5 | PASS — 30 |
| PostgreSQL : réservations lot 6 | PASS — 48 |
| PostgreSQL : accès invité lot 7 | PASS — 42 |
| PostgreSQL : catalogue lot 8 | PASS — 39 |
| Total automatisé | PASS — 204, aucun échec ou test ignoré |
| Comparaison avant/après et EXPLAIN ANALYZE sur données synthétiques | PASS — 50 essais par scénario/version, hors chauffe |
| git diff --check | PASS |
| Temps de chargement React, images réelles, réseau production | NON MESURÉS dans ce lot |

Aucun commit, push, merge, déploiement, notification réelle, paiement réel, accès à une base de production ou changement de variables de production. Les clients ne sont pas modifiés. Protection obligatoire des commandes invitées désactivée, frais de livraison inactifs, aucune purge automatique.

## Méthode et portée des mesures

PostgreSQL 17 neuf, isolé sur 127.0.0.1, base lot4_isolated. Le runner ne transmet au processus que des variables système nécessaires et des valeurs de test synthétiques. Le client Stripe est simulé ; le benchmark interdit explicitement les appels de paiement.

Jeu principal : 3 000 produits synthétiques, 8 variantes et 6 images par produit, 31 collections principales, 4 320 caractères de description par produit. Des fixtures historiques et cas limites des tests précédents sont également présents. Les images sont seulement des URL example.invalid : aucun fichier image externe n'est téléchargé.

Les handlers GET publics antérieurs au lot 8 sont conservés dans tests/fixtures/lot8-*-before.cjs, extraits du build des lots 1 à 7 avant les modifications. Les deux versions lisent le même jeu de données. La comparaison Admin utilise le même middleware JWT vérifié des deux côtés.

Avant : handlers du lot 7, sans les deux nouveaux index. Après : nouveaux handlers et index. Le benchmark enlève/recrée ces deux index uniquement dans la base isolée entre les phases, hors mesures, pour ne pas attribuer aux anciens handlers le bénéfice des nouveaux index.

Pour chaque scénario/version : 3 requêtes de chauffe, puis 50 GET séquentiels. Médiane et p95 par rang (p95 = 48e valeur triée sur 50). Les phases avant puis après ne sont pas randomisées : ordre, cache chaud, GC et charge du poste peuvent influencer les chiffres. Il s'agit de mesures locales, pas d'un test de débit concurrent ou d'une prédiction de production.

- HTTP : du début de fetch jusqu'à la lecture complète du texte de réponse. TTFB mesuré séparément dans le JSON brut.
- Serveur : de l'entrée du middleware de mesure jusqu'à finish. Cela exclut la réception antérieure à ce middleware.
- Prisma : durée des opérations du client, incluant attente du pool, transport local vers PostgreSQL, moteur Prisma et décodage. La transaction de pagination est mesurée dans son ensemble sans compter deux fois ses sous-opérations.
- PostgreSQL : durées effectives execute/statement et parse/bind du journal log_min_duration_statement=0 du cluster isolé. Le runner ne modifie aucune configuration de production. Cette mesure est imbriquée dans Prisma, pas additive avec lui.
- JSON : JSON.stringify du DTO, isolé par un wrapper de res.json propre au benchmark, identique avant/après. Il ne mesure pas le coût de sérialisation interne de Prisma.
- Express + DTO résiduel : durée serveur moins Prisma et JSON. Inclut routage, auth JWT, mapping des DTO, envoi Express/ETag et instrumentation ; ce n'est pas le coût pur du framework.
- Lecture du corps : après réception des en-têtes, lecture et décodage UTF-8 via fetch. Transfert réseau et décodage ne sont pas séparés. TCP local sans TLS, sans React, sans chargement d'images.

Les médianes/p95 de phases différentes ne s'additionnent pas exactement. La journalisation SQL et l'instrumentation ajoutent un coût dans les deux versions. EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) est rejoué séparément, hors échantillons HTTP, afin de vérifier les plans.

## Mesures finales avant/après

Toutes les durées suivantes sont en millisecondes.

| Scénario | HTTP avant médiane / p95 | HTTP après médiane / p95 | Serveur avant médiane / p95 | Serveur après médiane / p95 |
| --- | --- | --- | --- | --- |
| Liste historique, 24 produits | 16.214 / 20.753 | 15.975 / 18.362 | 8.189 / 9.743 | 4.784 / 5.854 |
| Fiche produit | 16.380 / 19.599 | 16.034 / 19.374 | 5.868 / 9.379 | 2.699 / 4.883 |
| Collection, 100 produits | 32.916 / 40.860 | 23.881 / 34.752 | 24.719 / 27.452 | 14.929 / 19.312 |
| Collection entière, 3 000 produits | 577.120 / 613.942 | 367.371 / 390.850 | 552.500 / 586.377 | 351.594 / 373.817 |
| Collection filtrée, 150 / 3 000 | 498.270 / 521.859 | 32.412 / 39.021 | 491.118 / 505.875 | 20.655 / 28.476 |
| Marques de la collection | 16.620 / 25.493 | 16.177 / 20.851 | 9.188 / 13.175 | 6.496 / 10.183 |
| Liste des collections | 16.143 / 19.808 | 15.723 / 19.676 | 4.264 / 6.101 | 3.405 / 5.710 |
| Collections Admin, JWT inclus | 32.850 / 36.296 | 16.321 / 20.427 | 20.777 / 24.141 | 6.000 / 7.967 |
| Nouvelle API, page 2 de 24 produits | — | 16.359 / 23.046 | — | 8.371 / 12.490 |
| Nouvelle API, tri global par prix | — | 17.222 / 30.503 | — | 12.082 / 17.769 |

Les petites réponses restent proches de 16 ms en HTTP local, malgré un coût serveur réduit. La cause de ce plancher n'est pas mesurée ici ; aucune affirmation d'amélioration sensible de la navigation du Store n'en est déduite.

## Décomposition mesurée

Chaque cellule indique médiane / p95, en millisecondes. PostgreSQL est inclus dans Prisma.

| Scénario / version | Prisma | PostgreSQL exécution | PostgreSQL parse/bind | Express + DTO résiduel | JSON | Lecture du corps HTTP |
| --- | --- | --- | --- | --- | --- | --- |
| Liste historique, 24 produits / avant | 7.679 / 9.158 | 4.204 / 5.045 | 0.237 / 0.381 | 0.452 / 0.644 | 0.078 / 0.122 | 0.211 / 0.397 |
| Liste historique, 24 produits / après | 4.162 / 5.315 | 0.413 / 0.604 | 0.179 / 0.347 | 0.482 / 0.632 | 0.068 / 0.086 | 0.164 / 0.263 |
| Fiche produit / avant | 5.514 / 8.800 | 3.324 / 5.214 | 0.140 / 0.289 | 0.337 / 0.493 | 0.009 / 0.015 | 0.067 / 0.109 |
| Fiche produit / après | 2.298 / 4.293 | 0.123 / 0.209 | 0.179 / 0.349 | 0.375 / 0.603 | 0.009 / 0.020 | 0.060 / 0.132 |
| Collection, 100 produits / avant | 23.040 / 25.770 | 5.797 / 6.981 | 0.559 / 0.688 | 1.179 / 1.318 | 0.488 / 0.536 | 0.731 / 1.635 |
| Collection, 100 produits / après | 13.160 / 16.888 | 2.585 / 3.455 | 0.437 / 0.709 | 1.321 / 1.632 | 0.416 / 0.674 | 0.531 / 3.078 |
| Collection entière, 3 000 produits / avant | 513.244 / 547.377 | 42.808 / 58.877 | 8.730 / 9.705 | 24.067 / 25.578 | 15.501 / 16.335 | 14.316 / 21.250 |
| Collection entière, 3 000 produits / après | 309.506 / 330.760 | 35.161 / 55.807 | 5.265 / 6.082 | 25.956 / 28.542 | 15.992 / 18.625 | 14.751 / 19.557 |
| Collection filtrée, 150 / 3 000 / avant | 485.457 / 500.142 | 40.834 / 56.385 | 8.200 / 9.431 | 4.718 / 5.128 | 0.842 / 0.970 | 0.695 / 0.952 |
| Collection filtrée, 150 / 3 000 / après | 18.113 / 26.149 | 3.375 / 5.800 | 0.542 / 0.770 | 1.684 / 1.852 | 0.718 / 0.915 | 0.625 / 0.845 |
| Marques de la collection / avant | 8.804 / 12.733 | 3.944 / 7.512 | 0.065 / 0.250 | 0.365 / 0.506 | 0.005 / 0.007 | 0.045 / 0.058 |
| Marques de la collection / après | 6.138 / 9.724 | 4.719 / 7.719 | 0.079 / 0.334 | 0.399 / 0.615 | 0.004 / 0.010 | 0.044 / 0.067 |
| Liste des collections / avant | 3.758 / 5.359 | 1.695 / 2.548 | 0.110 / 0.256 | 0.515 / 0.739 | 0.018 / 0.028 | 0.082 / 0.122 |
| Liste des collections / après | 2.748 / 4.865 | 1.281 / 2.196 | 0.085 / 0.429 | 0.563 / 0.843 | 0.017 / 0.025 | 0.077 / 0.171 |
| Collections Admin, JWT inclus / avant | 20.087 / 23.451 | 1.020 / 2.061 | 0.164 / 0.350 | 0.682 / 1.010 | 0.029 / 0.036 | 0.069 / 0.089 |
| Collections Admin, JWT inclus / après | 4.655 / 6.266 | 1.775 / 2.281 | 0.125 / 0.295 | 1.221 / 1.715 | 0.065 / 0.096 | 0.121 / 0.240 |
| Nouvelle API, page 2 de 24 produits / après | 7.997 / 11.922 | 2.300 / 3.809 | 0.270 / 0.469 | 0.291 / 0.386 | 0.091 / 0.141 | 0.055 / 0.072 |
| Nouvelle API, tri global par prix / après | 11.691 / 17.241 | 6.454 / 8.609 | 0.148 / 0.276 | 0.308 / 0.386 | 0.091 / 0.108 | 0.060 / 0.079 |

## Volumes et nombre de requêtes

| Scénario | Octets avant → après | Requêtes Prisma/SQL avant → après |
| --- | --- | --- |
| Liste historique, 24 produits | 83764 → 83764 | 5 → 5 |
| Fiche produit | 5048 → 5047 | 5 → 5 |
| Collection, 100 produits | 491152 → 504852 | 7 → 4 |
| Collection entière, 3 000 produits | 14719420 → 15130419 | 7 → 4 |
| Collection filtrée, 150 / 3 000 | 736089 → 756639 | 7 → 4 |
| Marques de la collection | 661 → 661 | 1 → 1 |
| Liste des collections | 2742 → 2742 | 1 → 1 |
| Collections Admin, JWT inclus | 35918 → 35918 | 3 → 2 |
| Nouvelle API, page 2 de 24 produits | — → 35942 | — → 10 |
| Nouvelle API, tri global par prix | — → 35960 | — → 10 |

Les collections contiennent maintenant de vraies options et leurs noms : le corps augmente d'environ 2,8 %, à nombre de produits et d'images inchangé. La collection entière reste à environ 15 Mo. Ce volume reste un problème pour un réseau réel et ne peut pas être supprimé sans adaptation du client ou modification du contrat.

Le nouveau endpoint de 24 cartes renvoie environ 36 Ko avec les variantes exactes et sans descriptions longues. Ce scénario n'est pas identique à la liste historique : il inclut une autre page et un DTO distinct ; ne pas présenter les octets comme une comparaison strictement identique.

Les GROUP BY de marques et COUNT des collections Admin peuvent augmenter légèrement le temps PostgreSQL tout en réduisant le transfert interne et le décodage Prisma. Ces petites régressions SQL sont visibles dans le tableau ; aucune amélioration universelle n'est revendiquée.

## Causes confirmées et corrections

1. Collection filtrée : auparavant, tous les produits de la collection, toutes les variantes/images et les autres collections étaient chargés avant le filtre vendor en JavaScript. Filtre déplacé dans PostgreSQL ; 150 produits hydratés au lieu de 3 000, 4 requêtes au lieu de 7.
2. Fiches : include complet récupérait des champs de variante, image, produit et collection non présents dans le DTO. select commun ne lit que les champs nécessaires, toutes les URL d'images de la fiche et les données utilisées des variantes.
3. Collections : le nom de collection est déjà connu. Les autres collections du produit ne sont plus chargées pour ce parcours. Les produits sont directement lus avec leur filtre de relation.
4. Marques : regroupement SQL, 20 groupes transférés au lieu de 3 000 lignes. Même contenu vendor/count, classement décroissant conservé, égalités désormais par vendor ascendant.
5. Collections Admin : COUNT en base au lieu du chargement de tous les liens ProductCollection uniquement pour obtenir leur longueur. Contrat exact conservé.
6. Recherche publique : le paramètre search était lu mais ignoré. Filtre maintenant appliqué AVANT la limite historique de 24. Recherche title/vendor/handle insensible à la casse et tags exacts sensibles à la casse. %, _ et antislash traités comme caractères littéraux.
7. Harmonisation : même transformateur et disponibilité physique moins réservée pour listes, collections et fiches. Variantes ordonnées par id, images par position puis id, collection représentative par collectionId. Pas de cache serveur ajouté ; prix/stocks modifiés restent visibles.

## Changements de comportement explicites et compatibilité

- GET /products reste un tableau limité à 24 comme avant. Pas de limite supplémentaire, pas de pagination silencieuse, pas de filtre de statut excluant des produits. Les paramètres historiques page/pageSize ignorés sur cette route ne changent pas sa forme.
- Les résultats publics sont ordonnés par id ascendant. Le prix représentatif reste celui de la première variante, mais première signifie désormais le plus petit id, pas l'ordre physique mutable de PostgreSQL. Ce correctif peut modifier un prix représentatif auparavant incohérent après une mise à jour Admin. Les commandes existantes ne sont pas recalculées.
- GET /products conserve une image par carte, comme avant. Fiches et collections conservent toutes les images. Ordre harmonisé position ascendant, null à la fin, puis id en cas d'égalité.
- Les collections ne renvoient plus colors/sizes vides si des options existent. Les champs option1Name/option2Name/option3Name sont ajoutés au DTO collection, compatibles avec le type Product facultatif du Store. Aucun champ historique n'est supprimé.
- Le nom de collection d'un produit dans une collection reste le handle demandé. Dans la liste/fiche il reste une collection représentative unique, rendue déterministe.
- Recherche absente ou vide : comportement de liste inchangé. Recherche invalide, multiple, trop longue ou sous forme search[] : 400 explicite. vendor exact ajouté à la liste ; filtre vendor historique des collections préservé et appliqué en base.
- Admin conserve les tableaux complets et tous les champs bruts nécessaires, y compris variantes/images/description. L'ordre de ses images/variantes est aussi rendu déterministe. Aucune action d'écriture Admin ou réservation n'est remplacée.
- Le tri des marques par nombre reste identique ; l'ordre des égalités, auparavant indéterminé, devient alphabétique. Les tests comparent le contenu des anciennes/nouvelles listes et vérifient cet ordre déclaré.
- Checkout et API des commandes/paiements ne sont pas modifiés.

## API paginée distincte

GET /api/catalog/products

Réponse : {items: CatalogueCard[], pagination:{page,pageSize,total,totalPages,hasNext}}.

Paramètres :
- page : entier de 1 à 1 000 000, défaut 1 ; pageSize : entier de 1 à 100, défaut 24.
- search : texte au plus 128 caractères, sémantique identique à la recherche publique historique corrigée.
- vendor : égalité exacte ; collection : handle ; size/color : égalité, sur LA MÊME variante.
- inStock=true/false : existence/non-existence d'une variante disponible satisfaisant size/color lorsque ces filtres existent. Une sélection inexistante ne devient pas un produit en rupture.
- minPrice/maxPrice : nombres décimaux positifs ou nuls avec au plus deux décimales ; borne supérieure 99 999 999,99 ; minimum ne doit pas dépasser maximum. Portent sur le prix représentatif, pas le minimum de toutes les variantes.
- sale=true/false : comparaison compareAtPrice/price de la variante représentative.
- sort : featured (défaut) ou id-asc, id-desc, name, name-desc, price-asc, price-desc. Ordre par id stable pour départager les égalités de prix/nom. Le tri name utilise la collation PostgreSQL, pas localeCompare italien.

CatalogueCard contient les champs historiques de carte sauf description, une URL d'image, les noms/options et stock total, et variants:[{id,sku,price,compareAtPrice,option1,option2,option3,stock}]. Aucun compteur réservé interne ou stock physique Admin n'est exposé dans cette nouvelle liste.

La pagination et le tri sont globaux AVANT la sélection de la page. COUNT, ids et hydratation sont lus dans une transaction REPEATABLE READ pour un snapshot cohérent à l'intérieur d'une réponse. Les pages successives sont des requêtes indépendantes : une modification du catalogue entre pages peut décaler une pagination offset. Un snapshot inter-pages ou curseur n'est pas garanti.

Tous les paramètres externes SQL sont liés ; les fragments de tri viennent d'une liste fixe. Données mal formées : 400. Erreur technique/transaction : 503 CATALOGUE_RETRY. Pas d'enveloppe de pagination introduite sur /products, les routes collections ou l'Admin.

## Index : justification mesurée et migration

Migration additive prisma/migrations/20261004210000_product_read_indexes/migration.sql.

| Index | Requête étudiée | Avant médiane / p95 | Après médiane / p95 |
| --- | --- | --- | --- |
| Variant_productId_id_idx | Relation d'une fiche produit | 1.290 / 1.389 | 0.017 / 0.024 |
| ProductImage_productId_position_id_idx | Relation d'une fiche produit | 1.034 / 1.185 | 0.016 / 0.023 |

Étude distincte : 20 EXPLAIN ANALYZE retenus après 3 chauffes par version, données et SQL identiques. Les scans séquentiels des 24 000 variantes / 18 000 images deviennent des scans indexés ciblés.

- Variant(productId,id) : facilite lectures exactes et ordre des variantes, ainsi que le premier prix des tris paginés.
- ProductImage(productId,position,id) : facilite les galeries ciblées et leur ordre.
- Aucun index vendor, description, FTS ou pg_trgm ajouté : aucune mesure de ce lot ne justifie un tel ajout.
- Pas de transformation de lignes, nouveau champ métier, backfill ou recalcul de commandes.
- Application uniquement dans les bases PostgreSQL synthétiques isolées. En production, CREATE INDEX standard peut bloquer les écritures pendant sa construction : prévoir une fenêtre et mesurer la taille réelle avant toute autorisation de migration. Une variante CONCURRENTLY demanderait une procédure de migration distincte validée ; elle n'est pas exécutée ici.
- Coût résiduel : stockage des index et entretien lors des créations/suppressions de variantes/images.

## Tests et vérifications

39 nouveaux tests couvrent : contrats historiques identiques sur données standard, produits au-delà de 24, pagination complète des 3 000 produits sans doublons, dernières pages, recherche rare/casse/tags/caractères spéciaux, injection SQL, filtres combinés et variantes exactes, tris globaux de prix/nom/id, paramètres invalides, toutes les images, options, stocks null/0/999/réservés, mise à jour de stock et prix Admin visible, collections de 100/150/3 000 produits, marques, authentification et données brutes Admin, cas sans variante, préservation historique et index.

Les 165 tests des lots précédents restent PASS. Les nouveaux tests ont d'abord identifié un paramètre search[] ignoré (corrigé) et un ordre différent à égalité de nombre de marques (désormais déclaré et testé). Une substitution de contrôleur liée aux fins de ligne Windows et Object.hasOwn incompatible avec la cible TS ont été corrigés lors du premier contrôle TypeScript. Aucun de ces échecs intermédiaires ne subsiste.

Dernier cluster : tests/.pg-lot4-1791095765457, arrêté dans finally. Aucun job d'expiration/purge ajouté. Les journaux SQL très détaillés sont réservés au runner synthétique et ne doivent pas être activés tels quels en production.

## Fichiers du présent lot

Application / migration :
- src/services/productRead.ts — nouveau select/DTO, recherche, disponibilité partagés.
- src/services/catalogue.ts — nouveau catalogue paginé, filtres/tri SQL liés, snapshot.
- src/controllers/catalogueController.ts — nouveau contrôleur du endpoint distinct.
- src/controllers/productController.ts — projections publiques et ordre des lectures Admin.
- src/controllers/collectionController.ts — filtres SQL, projection, agrégats, DTO commun.
- src/routes/productRoutes.ts — route /catalog/products additionnelle.
- prisma/schema.prisma — les deux déclarations d'index.
- prisma/migrations/20261004210000_product_read_indexes/migration.sql — création additive des index.

Tests / mesures / documentation :
- tests/catalog.integration.test.cjs
- tests/catalog-fixture.cjs
- tests/catalog-benchmark.cjs
- tests/fixtures/lot8-product-before.cjs
- tests/fixtures/lot8-collection-before.cjs
- tests/run-postgres-tests.cjs
- tests/catalog-baseline.json — exploration initiale, seulement 5 essais.
- tests/catalog-index-study.json — preuve de l'utilité des index.
- tests/catalog-performance.json — mesures finales et plans SQL complets.
- tests/LOT8_CATALOGUE.md — présent rapport.

Aucune dépendance ajoutée. Les autres fichiers non commités sont ceux des lots précédents. Le Store reste sur fix/store-product-loading avec son travail local intact. src/server.ts continue à appeler createApp() sans activer la protection obligatoire ou un transport de récupération.

## Adaptations futures, non implémentées

Store :
- Ajouter un service paginé distinct dans drip_frontend/src/services/productService.ts et des types CatalogueCard/Pagination dans src/types/product.ts ; ne pas faire retourner un objet à la fonction historique getProducts():Product[].
- Adapter src/hooks/useProducts.ts / src/lib/productQueries.ts local : clé React Query contenant page, taille, recherche, filtres et tri. Annuler les requêtes obsolètes, éviter les races, conserver des pages explicites sans concaténer des filtres différents.
- src/pages/Catalog.tsx : envoyer filtres/tri au backend, afficher total serveur, pagination ou chargement supplémentaire, remettre page à 1 sur changement de filtre. Le tri local d'une seule page ne représente pas le catalogue entier.
- src/pages/CollectionDetail.tsx : employer collection=handle dans la nouvelle API pour les grilles paginées. Conserver le endpoint historique pour les consommateurs qui nécessitent tous les produits/images jusqu'à leur adaptation.
- Home/BestSellers : possibilité d'adopter les cartes sans description, avec limite explicite ; la liste historique ne change pas dans ce lot.
- ProductDetail conserve le endpoint de fiche complet ; fetch de fiche avant cart/checkout reste nécessaire. Adapter la sélection aux combinaisons exactes des variants, prix et stock de la variante choisie, pas seulement aux ensembles sizes/colors ni au stock total.
- La présence option3 dans le nouveau DTO n'active pas sa vente : les contrats de création actuels restent limités aux sélections validées des lots précédents. Toute prise en charge d'une troisième option ou variantId au checkout exige un lot coordonné distinct.
- La disparition de description dans CatalogueCard ne doit pas vider une fiche produit mise en cache sous la même clé.

Admin :
- Les services actuels admin-drip/src/services/productService.ts et collectionService continuent à consommer les tableaux bruts ; aucun changement nécessaire pour ces optimisations.
- L'Admin ne doit pas remplacer son DTO brut par CatalogueCard : ce DTO public n'a ni description, ni tous les champs éditables, ni stock physique/réservations détaillées.
- Pour paginer la liste d'édition Admin à l'avenir : endpoint Admin distinct authentifié, DTO administratif conservé et adaptation coordonnée de ses tables/recherche/tri. Ce endpoint supplémentaire n'est pas implémenté dans le présent lot.
- La liste Admin de tous les produits et les grosses collections historiques restent non bornées ; leurs volumes peuvent rester élevés malgré les index. Prévoir une mesure spécifique sur le volume réel avant leur pagination.

Checkout : aucune adaptation relative au lot 8 ; les contrats de commande et paiement sont inchangés.

## Risques, limites et rollback proposé

- Gains uniquement locaux/synthétiques, caches chauds. Latence hébergeur, cold start Render, pool distant, TLS, réseau mobile, images CDN, React et charge concurrente ne sont pas mesurés.
- Collection entière encore ~15 Mo : la pagination côté Store reste nécessaire pour réduire le transfert réel. Le benchmark ne télécharge aucune image.
- Le prix représentatif par première variante stable ne remplace pas le prix de la variante choisie. Le backend de création reste autoritaire et valide ses stocks/remises.
- Le tri global par prix effectue des recherches de première variante par produit ; coût à re-mesurer sur des catalogues beaucoup plus volumineux. OFFSET et COUNT peuvent aussi devenir coûteux à grande échelle.
- Pas de garantie de snapshot cohérent entre plusieurs pages reçues à des instants différents.
- Le transfert Prisma/PostgreSQL, le décodage ORM et le pool ne sont pas individuellement séparés. Le résiduel Express et la lecture HTTP ne sont pas des mesures pures de framework ou réseau.
- L'exposition des commandes invitées reste celle du mode compatible du lot 7 ; aucun durcissement activé ici.
- Rollback proposé, après autorisation distincte : revenir aux handlers produits/collections du lot 7, retirer la nouvelle route si aucun client ne l'utilise encore, conserver les index et toutes les migrations des lots 4 à 7. Ne pas rollback les garanties paiement/stock/accès pour un problème de catalogue.
- Si des clients adoptent /catalog/products, garder ce contrat disponible pendant un rollback ; ne pas retirer silencieusement l'endpoint. Pas de migration destructive de retour ni de purge proposée.

Le lot 8 s'arrête ici. Toute adaptation client, migration/déploiement de production ou activation des protections attend une nouvelle autorisation.
