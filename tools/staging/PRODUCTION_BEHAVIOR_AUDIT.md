# Audit factuel des sources candidates production - 5 octobre 2026

Lecture Git et fichiers locaux uniquement. Aucun appel reseau, Stripe, Render,
Netlify ou PostgreSQL ; aucun paiement, test applicatif, migration, seed, commit,
push ou deploiement. Seul fichier cree : ce rapport. Aucune recommandation
d'implementation ou d'architecture dans cet audit.

## 1. Baselines : preuve et limite essentielle

**Les commits effectivement deployes en production ne sont pas prouvables avec
les elements locaux examines.** Une remote-tracking branch n'est pas un journal
de deploiement ; elle peut aussi etre perimee, aucun fetch n'etant execute ici.
Les domaines publics cites dans la conversation ne prouvent pas un commit servi.

| Application | Reference candidate locale | Commit candidat | Preuve du commit deploye |
| --- | --- | --- | --- |
| Store | origin/dripFrontend | bf60c5fd781655200ff0431a41233841ceb9256a | UNKNOWN / NOT PROVABLE |
| Backend | origin/dripBackend | d6107db9221ab746867639c4b99f8c6b2ee8397e | UNKNOWN / NOT PROVABLE |
| Checkout | origin/dripChekout, orthographe Git exacte | 6b9c8b963307f6771847d125d05ac4c9e2c3d05e | UNKNOWN / NOT PROVABLE |

```text
PROD_STORE_BRANCH=UNKNOWN / NOT PROVABLE; candidat origin/dripFrontend
PROD_STORE_COMMIT=UNKNOWN / NOT PROVABLE; candidat bf60c5f
PROD_BACKEND_BRANCH=UNKNOWN / NOT PROVABLE; candidat origin/dripBackend
PROD_BACKEND_COMMIT=UNKNOWN / NOT PROVABLE; candidat d6107db
PROD_CHECKOUT_BRANCH=UNKNOWN / NOT PROVABLE; candidat origin/dripChekout
PROD_CHECKOUT_COMMIT=UNKNOWN / NOT PROVABLE; candidat 6b9c8b9
```

Les fichiers _redirects Store/Checkout contiennent un fallback SPA
`/* /index.html 200`. Ils documentent les deep links, pas la branche Netlify.
Le package backend candidat demarre `node dist/server.js`. Aucune preuve locale
examinee ne lie un deploy Netlify/Render actuellement publie a ces trois SHAs.
Pour lever cette incertitude, il faudrait les SHAs et branches des derniers
deploys publies, leurs base directories et start commands, sans secrets.
Ils n'ont pas ete demandes a un service externe dans cet audit.

**Convention du reste du rapport :** « candidat production » designe ces trois
sources, pas un runtime de production certifie. Toutes les consequences reseau
sont conditionnelles a leur deploiement ensemble et a leur configuration effective.

Separation des ensembles :

- A : les trois sources candidates ci-dessus, priorite de cet audit.
- B : a922470/22dc26a et les fonctions Supabase supprimees, historique uniquement.
  Elles ne sont PAS traitees comme la production actuelle.
- C : staging/store @ 8b3bb0d, staging/checkout @ 2d3146d, staging/backend @
  40793c4 et modifications locales non commitees presentes dans les deux frontends.
  Leur etat source n'est pas une preuve de publication staging.

Les lectures A sont faites par `git show REF:chemin`, sans changer de branche.

## 2. Store candidat production

Sources principales sous drip_frontend/ : App.tsx, pages, services/productService.ts,
services/orderService.ts, services/api.ts, contexts/CartContext.tsx,
contexts/WishlistContext.tsx, components/layout/Layout.tsx et LoadingScreen.tsx.

### Pages et experience declaree dans le code

| Fonction | Comportement source |
| --- | --- |
| Home | Hero, promotion, collections, best sellers, temoignages, galerie, bande promotionnelle, videos/media Shopify, services et aide. Liens marketing externes et ressources distantes. BestSellers fetch direct getProducts, filtre flags/tags puis fallback huit premiers ; erreur console, section absente si vide. |
| Catalogue | Query produits et collections ; selection collection, tri featured/prix croissant/decroissant/nom en memoire ; filtres URL new/sale ; grille sm:2 lg:3 xl:4. Pas de pagination client. Il ne voit que la liste retournee par /products, limitee a 24 dans le backend candidat. isNew est toujours false dans ce DTO. |
| Collections | Liste depuis /collections avec productsCount, puis Promise.all de getProductsByCollection pour la premiere image de chaque collection (fan-out de lectures) ; detail via /collections/:handle/products, fetch local useEffect, filtre vendor backend disponible mais pas utilise par ce service client. Ce endpoint charge toute la collection. |
| Produit | Lecture par handle ; photos/description, choix taille/couleur, prix et compareAtPrice du DTO, stock agrege, selection initiale premiere taille/couleur, ajout une unite. Sticky action selon scroll/bas de page ; ajout desactive quand stock produit <=0. Pas de relecture de la variante selectionnee pour changer prix/stock. |
| Variantes | Options stockees avec la ligne du panier ; backend choisit premiere correspondance option1/option2 ou premiere variante si aucune correspondance. Pas de validation d'ambiguite/option3. |
| Wishlist | Snapshots Product en localStorage magic-city-drip-wishlist, unicite par product.id, toggle/add/remove ; pas d'API wishlist. |
| Panier | localStorage magic-city-drip-cart, snapshot Product + quantite + selectedSize/selectedColor ; lignes distinguees par id/taille/couleur. Quantites augmentees/retirees localement ; total product.price * quantity. Aucun plafond serveur de stock au checkout candidat. |
| Client | Nom/email et champs livraison saisis en React state ; exigence client nom/email, email contenant @ et ., address1/city/zip/country. Telephone/address2/state facultatifs. |
| Remise | Debounce 450 ms vers /discounts/preview avec subtotal navigateur et code. Validite depuis Discount DB ; erreur ramenee a invalid avec console. Anciennes reponses ne sont pas explicitement annulees par AbortController. Creation recalcule le prix/discount depuis DB. |
| Livraison | UI calcule 0 si subtotal >=99,90 sinon 9,90, apres quoi affiche totalWithDiscount. Le backend ne facture pas ces frais : total = produits moins remise. Difference source UI/montant Stripe, sans correction ici. |
| Loader | Layout combine useIsFetching/useIsMutating, LoadingContext et routeLoading 400 ms sur pathname. Overlay fixed inset-0 z-50 bg-background/80, LoadingScreen/Loader2 historique. Les fetch directs Home/detail collection ne sont pas automatiquement des activites React Query. |
| Erreurs/retry | FormError pour champs invalides ; checkout catch console.error puis alert. React Query avec QueryClient par defaut pour ses lectures ; valeurs effectives des retries dependant de la bibliotheque/environnement. Fetch directs n'ont ni deadline ni reprise persistante. |
| Responsive/navigation | Header desktop md:flex, menu mobile md:hidden ferme lors navigation ; MobileBottomNav et pb-16 md:pb-0, breakpoints grilles/typo, hover/transitions et sticky produit. Declaration CSS seulement, aucun rendu navigateur teste. |

Le fichier data/products.json existe, mais les services parcourus lisent l'API :
sa presence ne prouve pas que le catalogue affiche ce fichier de donnees.

### Clic « Procedi al Checkout »

La page declare une mutation React Query et `disabled={isPending}`, mais le
handler appelle **directement createCheckoutIntentFromCart**, pas mutateAsync.
Le isPending de cette mutation n'encadre donc pas cet appel effectif. Pas de
cle d'idempotence ou corps fige persistant dans ce candidat ; chaque clic/retry
peut creer un nouvel ordre. Aucun spinner de mutation garanti pour cet appel direct.

```json
POST {VITE_API_URL}/checkout/intent
{
  "customerName": "<saisie>",
  "customerEmail": "<saisie>",
  "items": [{"productId": 123, "quantity": 1,
             "selectedSize": "<option>", "selectedColor": "<option>"}],
  "discountCode": "<code facultatif>",
  "shipping": {"name": "<saisie>", "phone": "<facultatif>",
               "address1": "<saisie>", "address2": "<facultatif>",
               "city": "<saisie>", "zip": "<saisie>",
               "state": "<facultatif>", "country": "<saisie>"}
}
```

Pas de prix/total frontend dans cette demande de creation, pas de token guest,
Authorization ou Idempotency-Key. apiPost pose Content-Type application/json.
Base : VITE_API_URL, fallback http://localhost:4000/api ; valeur du build publie
UNKNOWN. Reponse 201 `{orderId,redirectUrl}`. Backend construit
`CHECKOUT_APP_URL + /checkout-landing?orderId=ID`, fallback localhost:5173.
La valeur effective CHECKOUT_APP_URL production n'est pas lue dans cet audit.

Store sauvegarde seulement `localStorage.lastOrderId = orderId`, puis
`window.location.href = redirectUrl` : meme onglet, sans popup/postMessage.
Aucune validation d'origine du redirectUrl dans ce handler. Aucun token/PII dans
l'URL construite par le backend ; seul orderId. Le panier reste sauvegarde dans
localStorage. Client/livraison/code restent en React state, sans sauvegarde de
demande figee, empreinte, grant ou sessionId avant navigation.

## 3. Checkout candidat : deux chemins distincts

App.tsx monte / Home, /cart Cart, /checkout-landing CheckoutLanding,
/order-confirmation OrderConfirmation et * NotFound, BrowserRouter sans basename.
Les gros blocs commentes de Cart/Landing ne sont PAS des handlers actifs.

### A. Arrivee directe sur /

Home affiche « Shop Collection »/interface italienne, cinq categories hardcodees :

| id | Libelle | Prix visible USD | Image |
| --- | --- | ---: | --- |
| shoes | Scarpe | 120,00 | /sneaker.png |
| bags | Borse | 180,00 | /bag.png |
| outerwear | Abbigliamento / Capispalla | 250,00 | Unsplash |
| dresses | Abbigliamento / Vestiti | 150,00 | Unsplash |
| tops | Abbigliamento / Top | 80,00 | Unsplash |

Images/cartes, hover zoom, fade-in/slide-up, grilles sm:2 lg:3 ; aucune API
catalogue dans Home. AddToCart genere `category.id-Date.now()`, nom italien,
description, prix en centimes, quantite 1 ; lib/cart ajoute genericName `Item N`.
Lignes au nouvel id temporel distinctes, pas un mapping vers Product/Variant DB.
Toast d'ajout et compteur local, pas de creation de commande a l'ajout.

Navigation : « Secure Shop », liens / et /cart, label cache sm en mobile,
compteur quantites/9+ ; event storage et interval **local de 1 s**, pas poll API.
Le panier est en **sessionStorage checkout_cart**, JSON encode par btoa/atob.
Ce Base64 n'est pas une protection cryptographique. checkout_session_id UUID
est cree au premier checkout ; aucune preuve d'autorisation serveur associee.

Cart : plus/minus, zero supprime, corbeille, total USD depuis prix local,
spinner bouton pendant fetch, bouton disabled loading. Bouton actif execute :

```json
POST {VITE_PRIMARY_API_URL}/seamless/checkout
{
  "sessionId": "<UUID local>",
  "encryptedCart": "<Base64 panier>",
  "items": [{"genericName": "Item N", "price": 12000, "quantity": 1}],
  "total": 12000
}
```

Si `{url}`, navigation href sans controle d'hote ; si `{orderId}`, navigate vers
/checkout-landing?orderId=... ; sinon erreur. Echec : console + toast, loading
termine, panier conserve. Ce bouton n'est donc **pas seulement visuel**.

**Le backend d6107db ne monte aucun /api/seamless/checkout.** Si le build pointe
vers ce backend et aucun proxy supplementaire, ce chemin ne trouve pas de handler
et echoue. Aucun achat Mirror reussi ou usage client reel n'est prouve ici.
Une autre API effective/proxy ne peut pas etre exclue sans preuve de deploiement.
VITE_PRIMARY_API_URL fallback localhost:4000/api, configuration effective inconnue.

Les fichiers integrations/supabase restent presents au candidat, mais aucune
reference Supabase n'a ete trouvee dans les pages actives/App/lib cart examines.
Les anciennes fonctions serve Supabase sont historiques B, supprimees du candidat.
demoItems de lib/cart est une liste exportee de demo, pas une source catalogue DB.

### B. Arrivee depuis Store

Landing lit `params.get("orderId")`. Sans id : erreur « ID ordine mancante ».
Avec id : GET /orders/ID/min **sans token**, affiche id, total et currency bruts,
etat loading/error. Paga ora appelle POST /pay `{orderId}`, sans grant ni preuve
de possession de la commande. Le bouton n'a pas de verrou paiement en cours,
ni condition PAID/PENDING ; le backend refuse une commande deja PAID.

La reponse `{url,sessionId}` est lue ; seule presence url verifiee. Navigation
normale `window.location.href=data.url`. **sessionId n'est pas sauvegarde.**
Ni panier Mirror, ni customer info, ni details produits Store ne sont requis ici.
Les labels SSL/PCI/Secure sont du texte UI, pas une preuve de controle runtime.

## 4. Sequence Store -> Checkout candidat

1. Store lit Product/Variant via API et conserve snapshot/options dans son panier.
2. Client renseigne nom/email/livraison, voit estimation et preview code.
3. Clic POST /api/checkout/intent ; aucune cle/grant/handoff.
4. Backend lit Product images/variants et Discount, choisit variante (fallback
   premiere), calcule subtotal/remise puis cree Order et OrderItem imbriques.
5. Pas de controle/reservation/decrement de stock dans cette creation ; invalid
   discount ignore. Statuts PENDING/PENDING, montant/devise et livraison snapshots.
6. Backend retourne id et URL Checkout construite depuis configuration.
7. Store sauvegarde lastOrderId en localStorage et navigue dans le meme onglet.
8. Checkout GET /orders/:id/min public ; aucune verification guest.
9. Client Paga ora -> POST /pay public ; backend cree une nouvelle Session Stripe,
   sauvegarde stripeSessionId puis retourne url/sessionId ; Checkout navigue Stripe.
10. Stripe revient sur le success_url configure ; Checkout confirme par session_id
    via backend, puis peut afficher confirme et vider son propre panier Mirror.
11. Store, au montage/rerender Layout, lit son lastOrderId publiquement ; si PAID,
    vide tout son panier courant et retire lastOrderId. Pas de snapshot de lignes
    achetees ni validation de l'id de reponse. Aucun listener focus explicite ici.

Refresh Landing : id reste dans URL, nouveau GET min possible sans stockage guest.
Back : donnees panier local conservees ; formulaire React non persistant, eventuelle
restauration bfcache dependant du navigateur ; nouveau clic peut recreer Order.
URL copiee/autre navigateur : l'id suffit pour ces lectures/pay dans le candidat.
Id change : autre ordre accessible si existant, pas de liaison au navigateur.
Un id inconnu retourne 404. Aucun nouveau protocole de transfert n'est deduit.

## 5. Backend candidat : contrats achat

Tous les chemins ci-dessous incluent /api monte dans server.ts. AUTH « aucune »
signifie absence de middleware de preuve sur cette route, pas absence de CORS.

| METHOD/PATH | CALLER source | AUTH | INPUT | OUTPUT | DB READ | DB WRITE | PURPOSE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET /api/products | Store catalogue/Home | aucune | search declare mais inutilise requete active | Product DTO[] max24 | Product/images/variants/collections | aucune | liste |
| GET /api/products/handle/:handle | Store fiche | aucune | handle | DTO ou404 | Product + relations | aucune | detail |
| GET /api/products/:id | route disponible, pas ce service Store | aucune | id numerique | DTO ou404 | Product + relations | aucune | detail id |
| GET /api/collections | Store Home/list/catalog | aucune | rien | id/handle/title/productsCount[] | Collection/count | aucune | liste |
| GET /api/collections/:handle/products | Store selection/detail | aucune | handle, vendor facultatif | collection + DTO[] | Collection et tous produits/relations | aucune | collection |
| GET /api/collections/:handle/brands | monte, appel achat non etabli | aucune | handle | marques | relations collection/products | aucune | filtre disponible |
| POST /api/discounts/preview | Store panier | aucune | subtotal client/code | valid/code/discountAmount/total | Discount | aucune | estimation |
| POST /api/checkout/intent | Store panier | aucune | client/items/options/code/shipping | 201 orderId/redirectUrl | Product/Variant/images/Discount | Order + OrderItem | creation |
| POST /api/orders | disponible, pas le handler Cart examine | aucune | meme type d'entree | 201 ordre avec items | Product/Variant/Discount | Order + OrderItem | creation directe |
| GET /api/orders/:id/min | Checkout + Store Layout | aucune | id | id/total/currency/status/paymentStatus/createdAt | Order | aucune | lecture minimale |
| POST /api/pay | Landing | aucune | orderId | url/sessionId, erreurs | Order | Order.stripeSessionId | nouvelle Session Stripe |
| GET /api/pay/confirm | confirmation Checkout | aucune | session_id | paid false/status/orderId ou paid true/order minimal | Stripe Session puis Order/update, Discount sicode | Order PAID/PROCESSING/session ; Discount usageCount++ | verification et finalisation |
| POST /api/stripe/webhook | Stripe, configuration effective inconnue | signature Stripe | raw event | received:true ou erreur | pas de relecture Session distante | Order selon metadata | notification |
| POST /api/seamless/checkout | Cart Mirror tente cet appel | ABSENT | panier generique/prix | aucun handler dans ce candidat | aucune | aucune | parcours non raccorde |

Modeles : Order contient client/PII/livraison, montants Decimal(10,2), devise,
paymentStatus, status, stripeSessionId ; OrderItem snapshots titre/handle/image/
prix/quantite/options/SKU et productId nullable. Variant contient prix/inventaire
(default schema 999), mais aucun reserve/decrement par ces handlers achat.
Discount contient usageCount/usageLimit/type/value/active/expiresAt.
Pas de GuestOrderAccess, OrderIdempotency, PaymentAttempt, PaymentFinalization,
StripeEvent ou tables de reservation dans le schema candidat historique.

L'auth JWT/bcrypt est admin, pas guest. Attention additionnelle : GET /api/orders
est branche sur adminGetOrders **sans prefixe /admin**. router.use('/admin',auth)
ne couvre pas cette route ; elle retourne client nom/email et montants de tous
les ordres dans cette source. Routes /admin/orders et detail sont protegees.
Observation statique uniquement, aucun appel realise.

server.ts : cors() global (pas liste stricte), Morgan dev, express.json, aucun
guard staging/live particulier. Morgan peut journaliser les chemins et queries
session_id/orderId. Aucun endpoint recovery/handoff guest dans ce candidat.

## 6. Construction exacte Stripe, sans appel Stripe

orderController.createStripeCheckout lit l'Order depuis DB, refuse inexistante
et PAID ; arrondit Decimal(total)*100, refuse montant nul/<50. Chaque appel cree
une Session ; pas idempotencyKey Stripe, pas reprise session existante avant
creation, pas PaymentAttempt. Sauvegarde le dernier stripeSessionId sur Order.

| Donnee envoyee | Valeur/construction | SOURCE |
| --- | --- | --- |
| mode | payment | constante backend |
| payment_method_types | [card] | constante backend |
| success_url | STRIPE_SUCCESS_URL.replace('{ORDER_ID}',order.id) | config + DB id |
| cancel_url | STRIPE_CANCEL_URL.replace('{ORDER_ID}',order.id) | config + DB id |
| line_items | UNE ligne, quantity:1 | constante backend |
| price_data.currency | STRIPE_CURRENCY puis Order.currency puis eur, lowerCase | config prioritaire / DB |
| price_data.unit_amount | Decimal(Order.total)*100, toDecimalPlaces(0) | DB total + calcul backend |
| product_data.name | Magic City Drip Order + orderNumber | constante + DB |
| metadata | {order_id:order.id} | DB |
| customer_email | order.customerEmail | saisie browser persistee DB |
| client_reference_id | ABSENT | non envoye |
| payment_intent_data / PaymentIntent direct | ABSENT | pas d'appel paymentIntents dans ce parcours |
| description / images | ABSENTS dans product_data | non envoyes |
| titres produits/variantes, SKU, tailles, couleurs | ABSENTS | restent dans OrderItem, non envoyes |
| adresse/telephone/livraison | ABSENTS de cet appel Stripe | seulement DB |

Donc Stripe recoit **le total et une reference d'ordre**, pas la composition
exacte du panier Store. Prix derives des variantes DB lors de creation ; remise
calculee backend. Shipping UI non ajoute. Le total n'est pas pris directement
dans l'entree browser de /checkout/intent. La quantite de chaque produit n'est
pas representee dans line_items Stripe : elle est deja agregee dans Order.total.

{CHECKOUT_SESSION_ID} n'est pas remplace par ce handler : il est laisse au
template Stripe si la variable configuree le contient. Les templates effectifs
production, devise effective et version Stripe effective restent UNKNOWN.
Client orderController utilise STRIPE_API_VERSION cast ; webhook utilise cette
variable ou fallback 2025-12-15.clover. Ni prefixe test/live, ni livemode controle
dans ces candidats. Les effets internes Stripe sur PaymentIntent/emails ne sont
pas observables depuis les seuls parametres envoyes et ne sont pas audites ici.

## 7. Confirmation et webhook candidats

OrderConfirmation accepte orderId ou order_id pour l'affichage/retour, mais
l'effet de confirmation depend seulement de session_id. Sans session : erreur.
GET /pay/confirm?session_id=ENCODED sans token ; backend retrieve Session Stripe,
prend metadata.order_id et exige payment_status === paid.

Il ne compare pas montant/devise/mode/attempt ni sessionId a la session conservee
de l'Order. Met PAID/PROCESSING et stripeSessionId a chaque confirmation payee.
**Chaque GET paye incremente Discount.usageCount de 1 si code**, y compris refresh,
reprise et appels concurrents ; update Order et compteur ne sont pas une
transaction de finalisation unique. Echec compteur seulement warn, paiement
reste finalise. Une ancienne Session payee peut encore servir a cette mise a jour.

Checkout transforme data.paid par Boolean, ne compare pas l'ordre retourne a
orderId URL. Si true : clearCart retire seulement checkout_cart de sessionStorage,
pas le panier Store. Affiche statut retourne et id court. Code formatPrice attend
centimes USD, alors que backend total est Decimal en unites et currency DB ;
**mais total est dans le bloc conditionnel order.items?.length**. Le backend
confirm ne retourne ni items ni createdAt : detail articles/total non affiche par
ce contrat ; date affichable remplacee par date courante. Ne pas affirmer une
conversion erronee visible sans ce contrat optionnel active.

Refresh : execute encore confirm, donc compteur remise encore incrementable.
Acces direct/copied URL avec session_id : possible sans stockage guest dans le
candidat ; orderId query est indicatif, metadata Session decide la cible backend.
Retour erreur/nonpaye : lien Landing avec orderId et bouton home Mirror. Paiement
reussi : le bouton Continua a fare acquisti utilise window.location.href =
SHOP_URL, issu de VITE_SHOP_URL avec fallback '/'. Il peut donc retourner au Store
si cette variable du build pointe au Store ; sinon retourne a Home Checkout.
Ce retour requiert le clic, il n'est pas automatique. Sa destination effective
publiee reste inconnue. Store vide via son propre Layout.

Webhook route exacte : POST /api/stripe/webhook. express.raw application/json est
monte **avant** express.json ; constructEvent(req.body,sig,STRIPE_WEBHOOK_SECRET).
Signature absente/invalide ->400 ; secret absent ->500. Raw body source correct.
Evenements explicites : checkout.session.completed et checkout.session.expired.
completed met PAID/PROCESSING par metadata sans controle payment_status/montant,
devise/attempt ou relecture Session ; expired met CANCELLED par metadata sans
guard ordre deja PAID. Pas dedup event/monotonie persistante. Un completed repete
reecrit l'etat ; un expired tardif peut modifier un ordre deja paye. Le webhook
ne consomme pas stock et n'incremente pas remise. Aucune notification email
applicative explicite dans ces handlers ; comportement Stripe externe inconnu.

## 8. Mirror et vraie commande : separation

```text
MIRROR_SHOP_PURPOSE=interface autonome generique mock + panier, tentative checkout API; intention commerciale non prouvee
MIRROR_PRODUCTS_BACKEND_CONNECTED=NO liaison catalogue dans le candidat Home/Cart
MIRROR_PAYMENT_CURRENTLY_USED=UNKNOWN runtime; appel actif source, handler absent backend candidat
MIRROR_STOCK_CURRENTLY_USED=aucun stock dans le code Mirror examine; stock runtime inconnu
REAL_PRODUCTS_SOURCE=Product/Variant DB exposes API candidat
REAL_CART_SOURCE=Store localStorage snapshots/options
REAL_ORDER_SOURCE=Backend /checkout/intent cree Order/OrderItem
REAL_PAYMENT_SOURCE=Backend /pay -> Stripe Session total Order
REAL_STOCK_SOURCE=Variant.inventoryQuantity lu pour UI; pas reserve/consomme par achat candidat
```

Aucune conclusion que les mockups doivent devenir des produits backend ; aucune
politique Mirror deduite ou proposee. Le vieux Supabase peut expliquer l'origine
du code, pas certifier le parcours actuellement publie ou utilise.

## 9. Comparaison A candidat et C staging local

Cette table compare des SOURCES. Prod effectivement servie et staging effectivement
publie restent UNKNOWN. C inclut explicitement les modifications locales non
commitees, pas seulement les commits staging.

| FEATURE | PROD candidat A | STAGING local C | DIFFERENCE |
| --- | --- | --- | --- |
| UI Store | pages historiques | restauration partielle avec controles actuels | parite absolue non validee |
| Spinner | overlay global + navigation400ms | overlay/hook restaure, fin echec testee | source restauree, navigateur inconnu |
| Catalogue | /products max24 sans pagination | contrat pagine/filtre/caches, DTO coherent | acces autres pages, controles serveur |
| Pagination | absente UI, limite24 serveur | offset + boutons visibles | difference visible |
| Cart | snapshots/product.price, pas tentative stable | panier + corps fige/key/token/budgets | reprises persistantes |
| Livraison | UI9,90 mais backend0 | livraison non activee, accord total serveur | UI/total differents |
| Checkout navigation | href redirect backend | commun DEV ou canal automatique configure ou mode historique | chemins selon flags |
| Same-tab/popup | same-tab | canal inter-origines local utilise popup | difference confirme source |
| Mirror UI | cinq categories et images hardcodees | restauree depuis candidat visuel | source similaire, rendu non valide |
| Mirror cart | Base64 sessionStorage, endpoint seamless | meme panier restaure, paiement refuse explicitement | API dangereuse/absente non appelee |
| Order access | public id seul | clients scoped ; serveur compatible sans token reste possible | pas protection obligatoire globale |
| Handoff | aucun | pont manuel backend + nouveau canal non commite | origines/windows/nonces/grants |
| Stripe creation | nouvelle Session a chaque /pay | PaymentAttempt, cle stable, lease, recuperation | garanties doublons/reprise |
| Confirmation | session query seule ; remise increment repetable | session/ordre/token verifies + finalisation transactionnelle | scope/EUR/idempotence |
| Stock | affichage agrege/1ere variante, pas reservation | variantes exactes, reservations/consommation uniques | garantie transactionnelle |
| Discounts | preview/read limit usageCount seul | reserveUses + finalisation/release | concurrence maitrisee |
| Idempotency | aucune persistante commande/paiement | OrderIdempotency et PaymentAttempt | demandes figees |
| Recovery | absent | primitive verifiee, transport email non configure | pas recuperation reelle promise |
| Security | CORS global, JWT admin, public routes achat | guards staging/origines, privacy/grants, compatible residuel | restrictions source sans changement prod |
| Performance | max24, collection complete, some fetch locaux | pagination/index/caches/annulations | frontend/backend nouveaux, pas mesure prod |
| Devise confirmation | formatter USD/cents optionnel | lecture/format EUR stricts | corrige contrat Store, Mirror autonome non implemente |
| Webhook | signature raw, writes directs | verification/reconciliation/dedup, staging test-only | checks et monotonie |

## 10. Conclusions et limites

```text
PRODUCTION_BASELINES_PROVEN=NO; trois candidats locaux identifies, deploys UNKNOWN
STORE_PROD_FLOW=UNKNOWN runtime; candidat: panier -> intent -> Order -> Landing -> pay -> Stripe -> confirm
STORE_TO_CHECKOUT_NAVIGATION=same-tab window.location.href dans candidat
CHECKOUT_DIRECT_VISIT_BEHAVIOR=candidat: Home Mirror/cart actifs; seamless absent backend candidat
CHECKOUT_FROM_STORE_BEHAVIOR=candidat: GET minimal public puis POST pay public avec orderId
MIRROR_ROLE=interface generique et panier autonome dans candidat; usage commercial reel UNKNOWN
MIRROR_BACKEND_COMMERCE=aucune liaison Product/Variant ni endpoint seamless dans backend candidat
MIRROR_PAYMENT_ACTIVE=handler frontend actif; paiement reussi/runtime UNKNOWN
STRIPE_PRODUCT_DETAILS_SENT=NO dans backend candidat
STRIPE_DATA_SENT=une ligne total/name ordre, metadata.order_id, customer_email, currency, success/cancel URLs
STRIPE_AMOUNT_SOURCE=Order.total DB *100 arrondi; total calcule depuis variantes/remise DB a creation
STRIPE_ORDER_REFERENCE_SENT=YES metadata.order_id et nom comprenant orderNumber
PROD_SECURITY_MODEL=UNKNOWN deploy; candidat guest public/id seul, adminJWT, webhook signature sans reconciliation forte
STAGING_SECURITY_MODEL=grants/idempotence/reservations/reconciliation/guards; compatible residuel serveur
VISIBLE_PROD_VS_STAGING_DIFFERENCES=source: pagination, frais affiches, popup, refus Mirror, erreurs/reprises, confirmation EUR
FACTS_PROVEN_FROM_CODE=routes/handlers/payloads/storages/navigation/constructionStripe/guards des candidats et C local
FACTS_NOT_PROVABLE_FROM_CODE=SHAs deployes, env builds, proxies, usages clients, achats Mirror reussis, donneesDB, dashboardStripe, rendu/mobile
NO IMPLEMENTATION RECOMMENDATION YET.
```

Aucune verification reseau, navigateur ou paiement executee ; aucune ancienne
preuve Supabase transformee en affirmation sur la production. Les 400 PASS
anterieurs ne sont pas des tests de ces candidats production. Aucun nouveau test
execute pour cet audit. STOP apres le rapport.
