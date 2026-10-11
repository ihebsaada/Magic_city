# Continuation - decisions prealables, 5 octobre 2026

Analyse complementaire uniquement ; aucune nouvelle modification applicative,
aucun schema Prisma ou fichier migration ajoute, aucun test/cluster relance.
Les 400 PASS du rapport precedent sont conserves comme preuve anterieure, pas
comme validation d'un nouveau protocole encore non implemente. Aucun commit,
push, merge, deploiement, appel public ou paiement. Backend toujours propre.

## Navigation historique confirmee

git show bf60c5f:drip_frontend/src/pages/Cart.tsx montre exactement :
window.location.href = redirectUrl apres creation de commande.
La cible est donc une navigation top-level dans le meme onglet, sans opener.
Le canal popup actuel ne remplit pas cette cible et reste en place tant que son
remplacement complet n'est pas valide. Aucun retrait partiel des protections.

## Proposition de transfert serveur

1. Store cree/reprend la meme commande et verifie le total comme actuellement.
2. POST /api/orders/:id/navigation-handoffs avec token source scoped en header et
   cle de creation de transfert persistante distincte de la cle de commande.
   Origine Store exacte, source active liee a cet ordre, no-store, quotas bornes.
3. Backend retourne une reference aleatoire opaque courte, valide deux minutes
   maximum et bornee par la validite du grant source. Aucune PII ou token durable.
   Creation idempotente : meme reference pour meme demande lors d'un resultat perdu.
4. Navigation normale vers le Checkout configure, orderId public et reference
   ephemere dans le fragment. Le fragment doit etre retire par replaceState avant
   initialisation analytics/tiers ; copie transitoire dans sessionStorage pour reload.
   CSP/no-referrer conserves. Aucune reference dans les journaux applicatifs.
   Une reference est une capacite temporaire : qui la vole avant redemption peut
   tenter de la consommer. L'absence de token durable ne rend pas ce vol inoffensif.
5. Checkout prepare et sauvegarde son propre grant avant POST de redemption.
   La reference voyage dans le corps, le token destinataire dans le header.
   Origine Checkout exacte, commande exacte ; aucune preuve par orderId seul.
6. Transaction : verrou ordre, transfert, grants ; revalidation source/expiration/
   revocation ; premiere redemption lie le destinataire et marque la consommation
   atomiquement. Un autre destinataire est refuse. Meme destinataire peut rejouer
   uniquement pour retrouver le meme accord actif, sans prolongation ni nouveau grant.
   Un accord deja acquis reste recuperable apres expiration du ticket, tant que
   le grant est actif ; expiration avant consommation bloque.
7. Checkout lit la commande scoped et verifie identite, montant et devise avant
   paiement. Puis retire la reference transitoire du stockage. Reload utilise le
   grant conserve. Retour Store conserve la demande et la cle initiales.

La creation doit retourner la meme reference apres perte de reponse : conserver
un chiffre du ticket (cle dediee serveur) ou utiliser une derivation HMAC avec
separation de domaine et cle serveur dediee. Ne pas stocker une reference brute
dans les logs ; rotation de cle et retention des tickets doivent etre explicites.
Les parametres du HMAC ne doivent pas rendre le ticket derivable publiquement.

## Persistance minimale proposee - NON CREEE

Une table additive NavigationHandoff, separee du pont manuel existant :

- ticketHash CHAR(64), PK : empreinte de la reference temporaire.
- creationKeyHash CHAR(64), UNIQUE : idempotence de creation du transfert.
- requestHash CHAR(64) : lie commande, source et destination a cette cle.
- orderId : FK RESTRICT vers Order.
- sourceHash CHAR(64) : FK RESTRICT vers GuestOrderAccess.
- recipientHash CHAR(64), nullable : FK RESTRICT vers GuestOrderAccess, renseignee
  seulement lors de la premiere redemption.
- checkoutOrigin : destination exacte configuree serveur.
- expiresAt, createdAt, redeemedAt nullable, revokedAt nullable.
- ticketCiphertext : uniquement si restitution par chiffrement, jamais raw ticket.
- index orderId/createdAt pour revocation et quotas.

Les noms/types sont une proposition a valider avant production du SQL.
Une creationKeyHash doit etre scoped a la source et son requestHash controle.
Plusieurs tickets ne doivent pas ecraser les anciens ; limites par ordre et source.
L'ordre de verrouillage reste celui de revoke/recovery/paiement. Revoke et recovery
invalident aussi ces transferts dans leur transaction existante.

Pourquoi pas une configuration statique : elle ne conserve ni gagnant de
redemption concurrente, ni consommation, ni replay apres redemarrage/multi-instance.
Un ticket signe seul reste rejouable sans etat serveur. Un cache memoire perd cette
preuve. OrderHandoff exige un recipientHash UNIQUE deja prepare avant creation,
et lie a ce destinataire : il ne conserve pas a la fois le grant source et le
destinataire inconnu avant navigation. Detourner origin ou ses champs de pairing
en stockage implicite changerait le protocole historique et ses garanties.

Impact : table additive, aucune reecriture d'ordres/grants/paiements anciens.
Rollback : couper seulement les nouvelles creations, garder table, endpoints et
routes tant que des tickets/grants emis sont utilisables. Ne supprimer aucun etat.
Application eventuelle exclusivement dans une base de test autorisee ; aucune DB
Render/production contactee dans cette passe. Aucune migration par defaut.

## Mirror : informations determinees, decisions manquantes

22dc26a Home.tsx et Supabase checkout confirment cinq offres independantes,
prix en centimes USD, pas de productId/variantId/SKU ou inventaire serveur :

| offerId historique | Nom historique d'achat | unitAmount cents | Devise |
| --- | --- | ---: | --- |
| shoes | Premium Footwear | 12000 | USD |
| bags | Designer Bag | 18000 | USD |
| outerwear | Premium Outerwear | 25000 | USD |
| dresses | Designer Dress | 15000 | USD |
| tops | Premium Top | 8000 | USD |

Ces definitions peuvent etre une configuration serveur statique versionnee,
staging-only : aucune table d'offres necessaire pour les prix historiques connus.
Le navigateur envoie offerId et quantite, jamais un montant trusted. Refuser champs
prix/devise inattendus, offres inconnues et quantites invalides ; calcul serveur
en centimes, demande figee et empreinte d'idempotence. Noms/images/panier UI gardes.
Les id historiques contiennent un suffixe temporel : conserver cet id de ligne et
ajouter un offerId interne explicite pour les nouvelles lignes. Les anciennes
lignes ne sont pas rapprochees par prix ni nom mutable ; prevoir un parsing strict
du format historique seulement si sa categorie est demontree, sinon blocage explicite.

Disponibilite, plafond commercial, stock reel et nature des offres ne sont PAS
definis dans l'historique. La fonction Supabase ne les controlait pas ; cela ne
prouve ni stock illimite, ni offre virtuelle, ni livraison possible. Pour tester
un achat synthétique, une politique explicite de simulation sans inventaire Store
peut etre autorisee. Ce n'est pas une politique commerciale reelle implicite.

Les tables Order/OrderItem existantes permettent productId nullable et snapshots
prix/devise : une migration Mirror n'est pas demontree indispensable a ce stade.
OrderIdempotency endpoint peut distinguer une creation Mirror de Store. Les
PaymentAttempt et reconciliation calculent deja depuis Order.total/currency et
controlent montant/devise/session. Ils ne doivent pas etre dupliques.

Mais startPayment exige OrderReservation ; creer une reservation vide pour passer
ce garde sans une politique explicite serait un contournement. Une absence de
stock doit devenir une politique metier verifiable, pas un artifice technique.
readOrder/formatMoney Checkout imposent actuellement EUR : ajouter USD seulement
pour un type Mirror authentifie par le serveur, sans elargir la devise Store ou
prendre le type depuis la query. Preserver les anciens montants/sessions EUR.
La provenance Mirror peut etre fondee sur la creation idempotente serveur ; si
une nouvelle colonne de provenance devient indispensable, nouvelle justification
avant migration. Pas de donnees client fictives pour contourner les champs requis.

## Fichiers et tests envisages, non modifies

Backend : service/routes navigationHandoff nouveaux, app/CORS/privacy/logs,
guestOrderAccess revoke/recovery, schema/migration additive sous autorisation ;
config Mirror trusted, creation idempotente Mirror, contrat minimal scoped pour
provenance/devise. Reutiliser paymentService/webhook sans nouveau moteur paiement.
Store : remplacer le branchement automatique de Cart par create/redirect, garder
corps/cle/token/spinner et historique. Checkout : bootstrap fragment propre,
redemption/reprise, Cart Mirror securise et confirmation scoped USD conditionnelle.
Outillage : scenarios/test runners, fault injection et simulateur local seulement.

Tests requis : ticket valide/absent/expire/revoque/autre ordre, source inactive,
origines strictes, replay autre grant, meme grant apres reponse perdue, concurrence,
rollback transactionnel, restart, reload, back/retry et double clic sans popup.
Mirror : offre inconnue, faux prix/devise, quantites invalides, idempotence et
fingerprint conflict, meme PaymentAttempt/session, webhook double/desordonne,
confirmation scoped et montant USD exact. Toutes suites precedentes conservees.
Catalogue pagination/caches/annulation/spinner restent inchanges ; verifier bundles
et absence de nouvelle boucle. Navigateur/visuel NON VALIDES, essais manuels requis.

## Arret prescrit et statuts

La section 7 demande : "STOP uniquement avant la migration" si une persistance
est indispensable. La section 5 interdit de fabriquer une politique de stock.
Ces deux conditions sont atteintes. Aucune implementation incomplete n'est ajoutee.

```text
PREVIOUS_TEST_BASELINE=400 PASS anterieurs
FINAL_TEST_COUNT=400 preuve anterieure; aucun nouveau test execute dans cette analyse
STORE_HISTORICAL_UX_PRESERVED=etat precedent conserve; popup encore presente
CHECKOUT_HISTORICAL_UX_PRESERVED=PARTIAL precedent conserve
MIRROR_HISTORICAL_UX_PRESERVED=interface/panier conserves; paiement bloque
SPINNER_PRESERVED=YES source inchangee
POPUP_DEPENDENCY=YES encore; remplacement concu, non implemente
NORMAL_NAVIGATION_RESTORED=NO; comportement historique confirme
HANDOFF_SECURITY_PRESERVED=etat precedent conserve
ORDER_ID_ONLY_DENIED=clients adaptes YES; serveur compatible residuel
HANDOFF_REPLAY_PROTECTION=nouveau protocole concu, non implemente
MIRROR_PAYMENT_IMPLEMENTED=NO
MIRROR_SERVER_PRICE_AUTHORITY=definitions historiques determinees; non implemente
MIRROR_BROWSER_PRICE_TRUSTED=NO nouveau paiement execute
MIRROR_CURRENCY=USD historique; aucune conversion
MIRROR_STOCK_POLICY=UNDETERMINED; decision necessaire
MIRROR_IDEMPOTENCY=conception reutilise OrderIdempotency; non implemente
MIRROR_PAYMENT_ATTEMPT_PROTECTION=conception reutilise PaymentAttempt; non implemente
MIRROR_STRIPE_RECONCILIATION=conception reutilise moteur existant; non implemente
STORE_PERFORMANCE_PRESERVED=code inchange
PAGINATION_PRESERVED=code inchange
STORE_TESTS=89 PASS anterieurs; non relances
CHECKOUT_TESTS=64 PASS anterieurs; non relances
BACKEND_TESTS=227 PASS anterieurs; non relances
CROSS_APP_TESTS=20 PASS anterieurs, 29 scenarios et 6 controles anterieurs
TYPESCRIPT=PASS anterieur; aucun code modifie
BUILDS=PASS anterieur; aucun code modifie
PRISMA=PASS anterieur; aucun schema/migration modifie
LINT=PASS fichiers concernes anterieur; pas de nouveau code
DIFF_CHECK=aucune nouvelle difference applicative
BACKEND_FILES_CHANGED=NONE
DATABASE_MIGRATION_REQUIRED=proposee pour NavigationHandoff; pas de migration Mirror justifiee a ce stade
REMAINING_BLOCKERS=autorisation persistance handoff; politique de disponibilite/stock/quantite Mirror
BROWSER_TESTS_REQUIRED=YES
READY_FOR_CONTROLLED_COMMIT=NO
READY_FOR_STAGING_DEPLOY=NO
```

Seul fichier ajoute dans cette continuation : ce document. Rien staged.
