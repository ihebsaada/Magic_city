# Store → Checkout — choix du transfert sécurisé

Analyse du 4 octobre 2026, Africa/Tunis. Implémentation arrêtée avant toute
modification applicative : la solution recommandée nécessite une autorisation
backend supplémentaire, conformément à la demande de cette phase.

## État préservé et vérifications effectuées

- Store : fix/store-product-loading, HEAD bf60c5fd781655200ff0431a41233841ceb9256a.
  Corrections phase B/intégration conservées ; aucun effacement de sessionStorage.
- Backend : fix/backend-order-privacy, HEAD d6107db9221ab746867639c4b99f8c6b2ee8397e,
  lecture seule. createApp() reste en mode compatible ; transport de récupération
  non configuré dans server.ts. Lots 1 à 8 inchangés.
- Checkout : sources lues par git show sur dripChekout@6b9c8b9. Aucun checkout,
  worktree, branche ou fichier applicatif Checkout créé/modifié.
- Trois HEAD HTTP publics, aucun appel API métier : Store /, Checkout
  /checkout-landing et /order-confirmation. Tous répondent 200, sans redirection.
  COOP, COOP-Report-Only, COEP, CSP, Referrer-Policy et X-Frame-Options ne figurent
  pas dans les réponses observées. Cette observation ponctuelle concerne les HEAD
  de ces chemins, pas tous les GET, CDN, futurs déploiements ou documents Stripe.
- Inventaire computer-use : apps=[] et browsers=[]. Aucun navigateur disponible
  via l'outil ; aucun parcours réel, popup ou paiement exécuté.

## Décision

postMessage est utilisable comme chemin rapide conditionnel ; il n'est pas retenu
comme UNIQUE moyen d'accès/reprise pour les exigences de cette phase. Les origines
actuelles n'exposent pas de COOP bloquant dans les réponses examinées, mais cela
ne garantit pas l'ouverture de fenêtre, le maintien du lien ou le retour mobile.
L'absence de navigateur n'est pas une preuve de dysfonctionnement ; elle empêche
de valider ces comportements ici.

Je recommande un pont backend authentifié avec appairage explicite pour les cas
où le canal navigateur est absent, et une récupération vérifiée si les credentials
ont été perdus. Aucun de ces comportements n'est installé. Le parcours automatique
dans le même onglet ne peut pas être promis entre les deux origines sans un canal
de transmission ou une authentification indépendante.

## Protocole postMessage évalué

Pour un éventuel chemin rapide ultérieur :

1. Ouvrir au plus une fenêtre neuve directement depuis le clic utilisateur,
   AVANT les awaits de vérification/commande. Ne pas employer une fenêtre nommée
   réutilisable inconnue. null ou référence isolée/fermée : ne pas envoyer de secret.
2. Conserver la WindowProxy en mémoire et la tentative Store inchangée. Après
   création connue et accord sur le total, valider l'origine ET le chemin du
   redirectUrl ; le naviguer vers Checkout avec seulement orderId.
3. Le Store émet un challenge aléatoire, lié en mémoire à cette fenêtre et à cette
   commande. Checkout répond avec le challenge et son nonce propre. Aucun nonce
   d'une demande extérieure ne remplace silencieusement le challenge attendu.
4. Chaque réception vérifie le schéma/version/type, event.origin EXACT,
   event.source égal à la référence attendue, orderId et les nonces attendus.
   Un sous-domaine, un suffixe ressemblant, origin=null ou source=null est refusé.
   Chaque émission emploie un targetOrigin exact ; jamais '*'.
5. Envoyer une seule capacité scoped à l'ordre attendu. Checkout persiste cette
   capacité dans sessionStorage avant d'accuser réception. Échec de stockage :
   aucun accès métier, aucun ACK de succès. Les doublons strictement identiques
   peuvent réémettre le même ACK ; un autre jeton/orderId/nonce ne remplace rien.
6. Séparer réception, persistance et acquittement. ACK perdu ne signifie pas que
   le secret a été perdu : ne pas recréer d'ordre ni de session Stripe. Un replay
   borné réutilise les mêmes valeurs. Délai dépassé : état explicite et reprise.
7. Après acquittement, retirer les listeners et rompre opener avant Stripe.
   Aucune récupération de référence par window.name, wildcard ou URL secrète.

L'origine de production Store est https://magiccitydrip.shop, celle de Checkout
https://dripcheckout.netlify.app. Les origines de staging doivent être des listes
explicites distinctes ; jamais une valeur fournie par query/message. La possession
d'une origine autorisée n'immunise pas contre une XSS sur cette origine.

### Limites et reprises

| Situation | Comportement sûr / limite |
| --- | --- |
| Popup bloquée | Aucun transfert ; reprise explicite. Ne pas demander de désactiver globalement les protections. |
| COOP same-origin, noopener ou noreferrer | Canal pouvant être supprimé ; ne pas affaiblir ces protections. |
| Reload du Store avant ACK | WindowProxy et challenge perdus. Ancien canal refusé. Si tentative/jeton subsistent, un nouveau clic peut ouvrir une nouvelle fenêtre pour LA MÊME commande. |
| Checkout fermé avant réception | Même commande conservée ; nouvelle fenêtre seulement sur demande explicite. |
| Store fermé avant réception | Aucun transfert automatique possible depuis ce Store. Si aucune autre copie valide du credential ne subsiste, récupération vérifiée nécessaire. |
| Mobile/webview ouvre une autre instance | Lien opener non garanti ; dépendance à tester, pas de fallback anonyme. |
| Retour Stripe dans le même onglet | Credential Checkout peut subsister ; vérifier effectivement le stockage et la session attendue. |
| Retour Stripe dans un nouvel onglet / stockage perdu | orderId/session_id ne sont pas une authentification ; appairage autorisé ou récupération vérifiée. |

Ces limitations ne prouvent pas que postMessage est intrinsèquement dangereux.
Elles empêchent d'en faire un canal universel et transparent. Un mode strict qui
bloque et demande une reprise manuelle pourrait être développé sans backend ;
il laisserait néanmoins les cas de perte complète dépendre de la récupération.

## Pont authentifié proposé — non implémenté

Un endpoint « donne-moi le jeton pour orderId » serait une nouvelle vulnérabilité.
Un cookie partagé entre magiccitydrip.shop et dripcheckout.netlify.app n'est pas
possible avec un Domain commun. Un cookie cross-site sur le backend dépendrait
des politiques de cookies tiers ; il n'est pas retenu comme garantie universelle.
Un éventuel Checkout sur un domaine commun/BFF demanderait une autorisation
d'infrastructure séparée ; aucun changement DNS, proxy ou cookie proposé à exécuter.

### Appairage sans capacité secrète dans une URL

Contrats indicatifs à revoir avec le backend AVANT implémentation :

1. Checkout prépare son propre jeton non lié via le mécanisme existant
   /order-access/prepare, le conserve avant la suite. Il ne reçoit pas le jeton
   brut déjà connu du Store. Le backend ne peut pas reconstituer ce dernier à
   partir de son empreinte ; aucune conservation réversible de secret n'est ajoutée.
2. POST /order-handoffs : preuve par le jeton préparé Checkout en en-tête, commande
   attendue comme référence publique, origine destinataire fixe. Création d'un
   appairage court (proposition : cinq minutes, inférieur aux quinze minutes de
   liaison), lié à l'empreinte du credential destinataire. Réponse : identifiant
   public d'appairage et phrase de contrôle, jamais un accès à la commande.
3. L'utilisateur compare la phrase affichée et saisit/valide l'appairage dans le
   Store encore authentifié par le jeton de sa commande. Aucun auto-accord sur
   l'identifiant de commande ou sur un message d'une fenêtre inconnue.
4. POST /orders/:id/handoffs/:pairingId/approve : autorisation par le jeton Store
   lié à cet ordre. Transaction : vérifier accès/expiration/révocation, commande
   et destinataire attendus, verrouiller appairage et grant destinataire, lier
   atomiquement le grant Checkout à CETTE commande puis marquer l'accord.
   Une autre commande ou un destinataire substitué provoque un refus complet.
5. POST /order-handoffs/:pairingId/redeem : proof du credential Checkout uniquement
   en en-tête. Après accord, renvoyer orderId/expiration/état public, sans réémettre
   le secret. Checkout connaît déjà son jeton : réponse perdue/reload peuvent
   reprendre avec les mêmes valeurs. Rédemption/approbation doivent être
   idempotentes et ne jamais lier ce grant à une seconde commande.
6. Checkout emploie ensuite son jeton scoped pour GET minimal, /pay et /pay/confirm.
   Le jeton Store, la clé d'idempotence et le corps figé Store ne changent pas.

L'identifiant d'appairage n'est pas une capacité d'accès : sa divulgation seule
ne doit permettre ni lecture, ni approbation, ni récupération du jeton. Même ce
référent peut rester hors URL pour réduire les traces. L'appairage explicite est
un changement UX, à faire accepter ; une phrase de contrôle ne remplace pas la
preuve cryptographique. Les deux grants sont des capacités équivalentes d'accès
à la même commande, pas une autorisation Admin.

Table Prisma additive envisagée OrderHandoff : identifiant, commande attendue,
empreinte du grant destinataire, origine exacte, échéance, approbation/rédemption,
révocation et références. Contraintes d'unicité et ordre de verrous à définir
avec GuestOrderAccess. L'empreinte seule est persistée ; pas de raw token, de
snapshot secret, de transformation historique ou de nouveau calcul financier.
Le grant Checkout devient un GuestOrderAccess ordinaire, donc doit respecter
la révocation globale existante de l'ordre et sa durée bornée.

À vérifier obligatoirement : CORS/Origin, en-têtes no-store/no-referrer sur erreurs
aussi, protection contre appairages massifs, tentatives d'approbation par commande,
non-énumération, stockage avant demande, idempotence et transactions concurrentes.
Pas de tâche automatique d'expiration/purge : échéances évaluées à l'utilisation.
Ce pont autorise seulement un nouvel accès scoped ; il ne crée aucune commande,
réservation, remise ou session Stripe et n'altère pas leur idempotence.

Si les deux onglets ont perdu leurs credentials, le pont ne rétablit pas une
identité par magie. Utiliser /order-access/recovery puis /redeem avec preuve livrée
à l'email déjà enregistré. Le transport actuel est non configuré : retour prévu
503 ORDER_RECOVERY_UNAVAILABLE. Configuration d'une notification réelle soumise
à une autorisation distincte, tests avec livraison simulée seulement.

## Adaptations Checkout prévues après accord sur le canal

- Créer un worktree dédié depuis 6b9c8b9 ; ne pas remplacer le Checkout par les
  fichiers présents sur une autre branche. Garder le Store et le backend intacts.
- Nouveau module credential : sessionStorage par orderId, validation stricte,
  interdiction de token dans URL/cache React Query/logs, sauvegarde préalable.
- Nouveau transport API : Order-Access-Token par appel sensible ; no-store,
  no-referrer, deadline couvrant le corps, annulation des lectures obsolètes,
  erreurs machine sans corps confidentiel dans console/UI.
- CheckoutLanding : attendre un credential scoped avant GET minimal et /pay ;
  aucun repli anonyme même si le backend compatible le permet encore.
- Avant /pay, enregistrer une tentative liée à l'ordre. Double clic bloqué.
  Si réponse perdue avant de connaître sessionId, reprendre /pay pour le même
  orderId : le backend lot 5 retrouve sa tentative stable. Ne pas inventer de
  sessionId côté client ni créer une nouvelle commande.
- Après {url,sessionId}, conserver sessionId AVANT navigation Stripe. Pas de
  reconstruction depuis un paramètre non authentifié. Retour : vérifier l'ordre
  et la session sauvegardés ; /pay/confirm reste vérifié côté backend.
- 401 : appairage/récupération ; 409 : conflit/expiration/revue métier explicite ;
  410 : état expiré, vérification sans nouvelle commande ; 429 : attente de
  Retry-After ; 503/network : budget borné, même ordre/session, aucune rotation.
  Une lecture manquante n'efface jamais le panier Store.
- OrderConfirmation : confirmer avec le credential correspondant ; ne considérer
  le paiement réussi qu'après réponse backend vérifiée, pas après retour URL.
- Monnaie : les totaux backend sont des unités monétaires décimales, pas des
  centimes Stripe. EUR affiché via Intl.NumberFormat italien ; supprimer USD et
  la division par 100. Ne pas utiliser des items supposés genericName/price si le
  backend ne les expose pas réellement ; GET minimal donne déjà total/currency.
- Retirer console.error(await res.text()) et autres impressions de réponses/API.
  Politique de document no-referrer ; audit CSP/XSS séparé sans affaiblir COOP.

## Validation en staging et critères

| Vérification réalisée ici | Résultat |
| --- | --- |
| Références Git et sources exactes | PASS — lecture seule |
| En-têtes publics des trois chemins | PASS observation — COOP absent ; pas une certification navigateur |
| Analyse protocole / contraintes / reprise | PASS analyse, protocole non implémenté |
| Navigateur disponible via computer-use | NON — inventaire vide |
| Transfert réel / mobile / retour Stripe | NON VALIDÉS |
| Nouveaux tests automatisés de transfert | NON EXÉCUTÉS — arrêt avant code |
| TypeScript/build/lint de cette phase | NON RÉEXÉCUTÉS — aucun code applicatif changé |
| Tests antérieurs Store | Rapport précédent : 78 PASS ; pas un résultat de cette phase |

Après autorisation du pont, préparer deux origines de staging explicites et un
backend isolé avec PostgreSQL synthétique, client Stripe simulé et livraison
recovery simulée. Ne pas utiliser les domaines publics pour des simulations de
commande. Aucun besoin de vrais credentials Stripe ou de commandes clients.

Tests automatisés : origine exacte/mauvais suffixe/null ; source erronée ; mauvais
orderId/nonces ; message malformé/rejoué ; ACK perdu ; popup nulle ; COOP rompant
le lien ; timeout et reload ; appairage expiré/révoqué ; fuite du pairingId seul ;
grant préparé jamais autorisé avant accord ; approbation/rédemption concurrentes ;
perte de réponse après transaction ; reprise après redémarrage ; isolation A/B ;
révocation globale ; /pay concurrent et réponse perdue ; conservation sessionId ;
confirmation incorrecte ; montants 9,90 / 99,90 EUR ; absence de secrets des traces.
Les invariants atomiques du pont demandent PostgreSQL réel de test.

Tests manuels navigateur requis : Chrome/Firefox/Edge desktop, Safari iOS et Chrome
Android, navigations internes et webviews pertinentes ; popup autorisée/bloquée,
COOP strict sans affaiblissement, fermeture de chacun des onglets à chaque étape,
reload/retour navigateur, stockage indisponible, ACK perdu, retour Stripe même
onglet/autre onglet, accès révoqué/expiré, reprise de session, double clic et deux
ordres distincts. Vérifier réseau/console/analytics/referers, jamais les secrets
dans un rapport ou une capture. Si aucune instance navigateur n'est disponible,
ces scénarios resteront NON VALIDÉS malgré les tests simulés.

Critères : aucun accès sur orderId/pairingId seul, aucune nouvelle commande lors
des reprises, une session active réutilisée, credential scoped persisté avant
opérations, aucune fuite de secret, blocage explicite et récupérable des échecs.
TypeScript/build/tests/lint modifiés doivent passer sur les deux clients.
La protection obligatoire, les frais de livraison et la production restent hors
de cette phase. Tout déploiement exige une autorisation séparée.

## Fichiers et autorisation attendue

Seul fichier ajouté dans cette phase :
drip_frontend/tests/STORE_CHECKOUT_TRANSFER_ANALYSIS.md (ce rapport).
Aucun fichier applicatif, tentative existante, branche, commit, push, merge,
worktree, base, variable de production, service ou déploiement modifié/créé.

Autorisation nécessaire avant de continuer : conception détaillée et implémentation
du pont d'appairage backend décrit ci-dessus, migration additive et tests isolés,
puis adaptations Store/Checkout et validations. Le transport de récupération
réel reste une décision distincte, non demandé à activer maintenant.

## Références

- https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- https://developer.mozilla.org/en-US/docs/Web/API/Window/open
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy
- https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies

Ces sources expliquent les mécanismes du navigateur. Elles ne certifient pas le
fonctionnement de nos deux applications sur un navigateur réel.
