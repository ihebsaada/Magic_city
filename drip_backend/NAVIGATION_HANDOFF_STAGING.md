# Navigation staging dans le meme onglet - 5 octobre 2026

Changements locaux uniquement. Aucun commit, push, deploy, Stripe reel ou DB
Render/production contacte. Migration distante NON APPLIQUEE.

## Protocole

POST /api/orders/:id/navigation-handoffs exige staging=true, Origin Store EXACT,
Order-Access-Token du grant source actif lie a cet ordre, et Idempotency-Key stable.
La destination vient de handoffOrigins.checkout, jamais du body ou de l'URL client.
Reponse no-store : orderId, ticket opaque aleatoire de 256 bits, expiresAt.
TTL max 120 secondes et borne par expiresAt du grant source. Quota 10 creations
par ordre/heure en base ; throttle par IP partage avec le pont historique.

POST /api/navigation-handoffs/redeem exige Origin Checkout EXACT, grant destinataire
prepare sauvegarde avant envoi et body orderId/ticket. Verrou ordre, ticket et
grants dans une transaction PostgreSQL. Un autre destinataire ou ordre est refuse.
Premiere redemption atomique : grant lie et ticket marque consomme. Le meme grant
peut rejouer sans prolongation apres une reponse perdue, meme apres le TTL du ticket,
uniquement si les grants source/destinataire restent actifs. Expiration AVANT
consommation bloque. Revoke/recovery verifiee invalident aussi ces transferts.
Une cle de creation identique retourne le meme ticket ; conflit refuse, jamais
nouvelle commande/session pour contourner. Source/recipient ne peuvent etre egaux.

## Persistance et cryptographie

Migration locale : 20261005120000_add_navigation_handoff/migration.sql.
Une table NavigationHandoff : ticketHash PK SHA-256 ; creationKeyHash UNIQUE
scoped au sourceHash ; requestHash lie ordre/source/destination ; ticketCiphertext ;
orderId/sourceHash/recipientHash(nullable) ; checkoutOrigin ; expiresAt ; redeemedAt,
revokedAt nullable ; createdAt. Trois FK RESTRICT vers Order et GuestOrderAccess.
Index UNIQUE creationKeyHash et index orderId/createdAt ; aucun autre type/table.
Aucune alteration SQL des 15 migrations precedentes. Aucun etat ancien reecrit.

Le ticket brut n'est pas persiste. Restitution deterministe depuis AES-256-GCM :
IV aleatoire 12 octets, tag 16 octets, ciphertext base64url. Cle derivee SHA-256
avec separation de domaine depuis NAVIGATION_HANDOFF_SECRET dedie au staging,
32 caracteres minimum, distinct de JWT/Stripe. Ne jamais la journaliser ni la
changer pendant que des creations peuvent etre reprises. Sans cle valide, refus
503 ; aucun fallback. Le secret est un placeholder dans .env.staging.example.
Le harness injecte sa propre valeur synthetique, sans copier un .env distant.

La migration a ete appliquee exclusivement aux nouveaux clusters PostgreSQL
loopback isoles des validations. Le fait qu'elle fonctionne localement n'autorise
pas migrate deploy sur Render. Rollback sans destruction : conserver table,
grants, endpoints et routes pour les tentatives emises ; arreter l'entree de
nouvelles tentatives sous une procedure revue. Aucun DROP ou rewrite propose.

## Livraison

Uniquement pour les nouvelles creations staging : subtotal marchandises serveur
avant remise <200,00 EUR => 5,00 EUR, sinon zero. Prix/discount/shipping/total client
ne sont jamais autoritaires. originalTotal conserve le subtotal, discountAmount
la remise et total le montant final ; livraison = total-originalTotal+discountAmount.
Aucune migration livraison. Les replays existants conservent leur snapshot de prix.
Stripe conserve une seule ligne agregee, montant final en centimes, sans noms,
variantes, SKU ou images des produits. Le Mirror USD reste hors backend.

## Deploiement futur - non execute

Le service actuellement publie reste hors scope. Avant tout nouveau deploy,
autorisation explicite de revue/application de cette migration sur staging,
configuration de la cle dediee et des origines exactes, build frontend MODE=staging
avec VITE_NAVIGATION_HANDOFF_ENABLED=true coordonne dans les deux applications,
validation navigateur desktop/mobile et CSP du bootstrap fragment requis.
Ne jamais utiliser le simulateur loopback dans un build de production ou public.
Les flags historiques et le pont restent disponibles pour les anciens essais.
