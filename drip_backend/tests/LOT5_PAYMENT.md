
# Lot 5 - sessions Stripe et transitions de paiement

Validation locale du 4 octobre 2026. Worktree Magic_city_backend_security,
branche fix/backend-order-privacy, base de production d6107db.
Lots 1 a 4 conserves. Aucun commit, push, merge, deploiement, paiement reel,
acces a une base de production ou modification de configuration de production.
Store, Admin et Checkout non modifies. Livraison toujours inactive.
Aucune purge ajoutee ou planifiee.

## Resultat PASS/FAIL

| Controle | Resultat |
| --- | --- |
| TypeScript: npm run typecheck | PASS |
| Build: npm run build (execute par les deux suites) | PASS |
| Prisma validate avec URL de test synthetique | PASS |
| Contrats et donnees synthetiques: npm test | PASS, 28/28 |
| Integration PostgreSQL 17, idempotence commandes lot 4 | PASS, 16/16 |
| Integration PostgreSQL 17, paiements lot 5 | PASS, 30/30 |
| Scenarios obligatoires du lot 5 | PASS |
| Paiements Stripe reels, navigateur et production | NON EXECUTES |

74 tests passes, aucune erreur finale. Le premier passage a revele une incoherence
du simulateur: plusieurs commandes artificielles reutilisaient le meme identifiant.
Le simulateur reinitialise maintenant sa tentative lorsque cette commande fictive
est recreee. Aucun changement de tarification n'a ete necessaire.
Prisma validate a initialement signale l'absence de DATABASE_URL dans le shell.
Le controle a ete repris avec une URL synthetique locale dans un processus
isole; aucune variable du shell ou de production n'a ete modifiee.

Le runner cree un nouveau cluster PostgreSQL sur 127.0.0.1, avec port aleatoire,
role et base de test dedies. Il applique les migrations historiques, cree une
commande synthetique ancienne, puis applique les migrations additives des lots
4 et 5. Les suites sont executees sequentiellement pour eviter les collisions
de nettoyage. Les variables du processus sont limitees aux chemins systeme et
aux valeurs synthetiques construites par le runner. Le cluster est arrete en
finally et ses fichiers ignores sont conserves pour inspection. Aucun dotenv
ou secret de production n'est transmis aux serveurs de tests.

Stripe est remplace avant import de l'application. Les appels create/retrieve
n'utilisent aucun reseau externe. Le vrai SDK est utilise uniquement pour signer
et verifier localement les corps webhook synthetiques.

## Implementation

PaymentAttempt enregistre avant l'appel Stripe une generation par commande,
une cle UUID stable et les parametres exacts de creation. Le montant est celui
de Order.total, arrondi HALF_UP en centimes, et la devise vient de Order.currency.
Les URL et l'adresse client sont capturees dans la demande persistante:
les reprises ne reconstruisent pas des parametres differents.

Le verrou PostgreSQL sur la commande serialise la creation des generations.
Un bail persistant de 30 secondes limite les appels externes simultanes.
Le SDK a un timeout de 15 secondes et aucune reprise automatique.
Un concurrent attend au maximum environ une seconde pour la session enregistree;
si le premier appel n'a pas fini, il recoit 503 PAYMENT_RETRY.
Toute reprise conserve la meme tentative, les memes parametres et la meme cle.
Un bail laisse par un processus arrete expire et peut etre repris.

Une session connue est relue chez Stripe et reutilisee tant qu'elle est ouverte.
Une nouvelle generation est permise seulement apres expiration verifiee chez
Stripe. Une session complete mais non payee ne provoque pas de nouvelle creation.
Une expiration modifie uniquement la tentative, jamais le statut de la commande.

Une tentative inconnue/non resolue depuis 23 heures est bloquee par
409 PAYMENT_RECONCILIATION_REQUIRED. Cette marge empeche de creer une seconde
session avec une cle potentiellement oubliee par Stripe.
Stripe peut supprimer ses cles apres au moins 24 heures et conserve aussi les
reponses 500: https://docs.stripe.com/api/idempotent_requests
Aucune reprise aveugle ni rotation automatique de cle n'est faite.

Les confirmations et les webhooks appellent reconcilePayment. La session est
relue chez Stripe avant la transaction: signature valide seule ou ancien
snapshot paid ne suffisent pas. Controle du mode payment, de l'identifiant de
session, de la commande, de la tentative, du montant, de la devise et de
payment_status=paid avec status=complete.

Le verrou de commande, PaymentFinalization unique par commande et par session,
et l'increment de remise dans la meme transaction garantissent un seul effet
de finalisation. Une erreur d'increment annule egalement paiement, finalisation
et evenement. StripeEvent memorise uniquement identifiant, type, session et date,
sans corps webhook ni donnees client. Doublons et ordre d'arrivee ne font pas
regresser les etats PAID, SHIPPED, DELIVERED ou REFUNDED.

Evenements pris en charge: checkout.session.completed,
checkout.session.expired, checkout.session.async_payment_succeeded,
checkout.session.async_payment_failed. Les evenements non pris en charge
gardent la reponse received:true. Un echec temporaire retourne un statut non-2xx,
pour permettre une nouvelle livraison. Une signature incorrecte retourne 400.
Les corps sont verifies bruts, avant express.json.
Reference: https://docs.stripe.com/webhooks

L'Admin conserve PATCH et sa reponse {ok:true,id}, avec validation des enums et
verrou commun. Les transitions arriere de paiement, de livraison et la
reactivation d'une commande annulee sont refusees par 409.
Le passage manuel PENDING->PAID et PAID->REFUNDED reste possible pour conserver
le fonctionnement existant: ce sont des declarations administratives, pas un
paiement ou remboursement Stripe. Aucune operation Stripe de remboursement
n'est ajoutee.

## Migration additive

prisma/migrations/20261004120000_add_payment_attempts/migration.sql:
- PaymentAttempt: unicite (orderId,generation), idempotencyKey, sessionId;
  montant positif representable en INTEGER, generation positive, etats limites.
- PaymentFinalization: orderId primaire, sessionId unique.
- StripeEvent: identifiant evenement primaire.
- Relations vers Order avec ON DELETE RESTRICT.

Aucune colonne existante, total, remise, frais ou commande n'est recalcule.
Aucun backfill. Une session historique est adoptee seulement si elle correspond
au stripeSessionId deja enregistre et au montant/devise de la commande.
Une ancienne commande deja payee n'incremente pas retrospectivement sa remise.
Les donnees synthetiques creees avant migration sont verifiees apres migration.

Cette migration n'a ete appliquee qu'aux clusters de tests locaux.

## Tests de paiement PostgreSQL

Les 30 cas couvrent:
- Deux /pay simultanes, repetitions et une seule generation/session.
- Timeout avant creation et perte de reponse Stripe apres creation.
- Creation Stripe puis erreur PostgreSQL reelle injectee par trigger;
  reprise avec la meme cle et une seule session distante.
- Reconstruction du module applicatif et reprise d'un bail expire.
- Confirmation/webhook simultanes, doublons et evenements distincts.
- Snapshot completed/paid trompeur alors que la session reelle est impayee.
- Signature incorrecte, mauvais montant, mauvaise devise, mauvais mode,
  mauvaise tentative et session inconnue.
- Expiration verifiee, renouvellement concurrent, expiration ancienne tardive,
  evenements desordonnes, etats expedie/livre/rembourse preserves.
- Paiement tardif d'une commande annulee exigeant une reconciliation.
- Adoption d'une ancienne session, ancienne commande payee et commande
  synthetique creee avant migration.
- Tentative non resolue trop ancienne, bail actif et contraintes d'unicite.
- Webhook recuperant un paiement dont la session n'a pas ete enregistree localement.
- Rollback transactionnel sur echec d'increment de remise.
- Session complete impayee non remplacee.
- Transitions Admin valides conservees et regressions refusees.

La reconstruction de paiement recharge le module et reutilise la base existante;
elle ne tue pas brutalement un processus. Le lot 4 teste deja un vrai
redemarrage de serveur pour les commandes. Aucun test ne pretendra reproduire
une panne physique de machine ou un comportement du reseau Stripe reel.

## Contrats et adaptations clientes futures

Verification en lecture seule des versions deployees:
- Store bf60c5f, drip_frontend/src/services/orderService.ts:
  POST /checkout/intent et {orderId,redirectUrl} inchanges.
- Checkout 6b9c8b9, seamless_checkout_flow/src/pages/CheckoutLanding.tsx:
  POST /pay avec {orderId}, succes {url,sessionId} inchanges.
- Checkout OrderConfirmation.tsx:
  GET /pay/confirm?session_id, {paid,...} et champs order inchanges.
  total reste un Decimal serialise en euros, pas un montant en centimes.
- Admin d0c2248, admin-drip/src/pages/admin/Orders.tsx et
  src/services/orderService.ts: GET/PATCH authentifies, mappings inchanges.
- GET /orders/:id/min reste identique et les routes sensibles restent no-store.

Aucun changement client n'est necessaire pour l'unicite des sessions cote serveur.
Pour une reprise utilisateur fiable, une phase cliente autorisee devra:
1. CheckoutLanding: desactiver le bouton pendant /pay, garder le meme orderId,
   traiter 503/Retry-After avec reprises bornees; ne jamais recreer une commande
   pour resoudre une erreur /pay.
2. OrderConfirmation: reprendre la confirmation apres erreur reseau, sans
   proposer immediatement un nouveau paiement; conserver orderId/sessionId,
   verifier les etats PAID/REFUNDED et afficher une attente/reconciliation.
3. Checkout: distinguer 409 ORDER_NOT_PAYABLE, PAYMENT_NOT_OPEN et
   PAYMENT_RECONCILIATION_REQUIRED; relire le resume de commande et proposer
   une assistance si la session est complete ou la commande annulee.
4. Store: appliquer l'adaptation de cle de creation deja decrite au lot 4.
   Le Store actuellement deploye sans cle peut encore creer deux commandes
   distinctes; le lot 5 deduplique les sessions d'une meme commande seulement.
5. Admin: afficher les erreurs de transition 409, conserver les etats terminaux
   et expliquer que modifier REFUNDED n'effectue pas un remboursement Stripe.

La page de confirmation Checkout a deja un type total en centimes/USD alors
que le backend renvoie un Decimal en euros. Son affichage de total est
conditionne a items, absent de la reponse actuelle; ce probleme preexistant
n'est pas active ni corrige ici.

## Risques et limites

- Garantie pour les nouvelles tentatives et les sessions historiques connues.
  Des sessions anciennes creees sans cle et perdues avant leur enregistrement
  par le backend de production ne peuvent pas etre retrouvees par ce code.
  Leur inventaire/reconciliation Stripe sera necessaire avant une future mise
  en service; aucun compte Stripe n'a ete consulte ici.
- Aucune verification de la configuration Stripe de production: version API,
  abonnement aux evenements, URL de retour et devise doivent etre verifies dans
  un staging autorise. L'ancien override STRIPE_CURRENCY n'est plus utilise pour
  contredire Order.currency. Des sessions historiques en devise differente sont
  bloquees plutot qu'acceptees silencieusement.
- Les tentatives inconnues anciennes, paiements tardifs de commandes annulees,
  sessions completes impayees et incoherences exigent une reconciliation.
  Aucune tache de reconciliation ou purge n'est programmee.
- Le webhook effectue une lecture Stripe synchrone. Une indisponibilite renvoie
  503 et depend des nouvelles livraisons Stripe ou d'une confirmation ulterieure.
  Une file de traitement durable n'est pas implementee dans ce lot.
- Pas d'appels a un compte Stripe de test: le simulateur et les signatures
  locales ne valident pas l'integration effective avec un compte Stripe.
- La signature verifie l'origine; les routes publiques compatibles /pay,
/pay/confirm et /orders/:id/min n'acquierent pas une authentification client.
  Les controles d'acces complementaires et limitation de debit restent a traiter.
- Les reservations de stock, limites concurrentes d'utilisation de remises,
  remboursements/disputes Stripe et autres lots 6 a 8 ne sont pas implementes.
- La declaration administrative manuelle PAID reste autorisee. Le ledger
  empeche les increments automatiques repetes; il n'atteste pas cette declaration.
- Si une remise a ete supprimee, updateMany ne recree pas le code ou son compteur.
- Montants hors representation INTEGER pour une tentative: refus avant Stripe.
- Conservation des tentatives, finalisations et identifiants d'evenement:
  aucune suppression ni politique de purge automatique ajoutee.

## Fichiers modifies pour ce lot

- src/services/paymentService.ts (nouveau)
- src/services/stripeClient.ts (nouveau)
- src/controllers/orderController.ts
- src/controllers/stripeWebhookController.ts
- prisma/schema.prisma
- prisma/migrations/20261004120000_add_payment_attempts/migration.sql (nouveau)
- tests/contracts.test.cjs
- tests/payment.integration.test.cjs (nouveau)
- tests/run-postgres-tests.cjs
- tests/LOT5_PAYMENT.md (ce rapport)

## Validation et rollback futurs, non executes

Appliquer la migration additive et regenerer Prisma dans un staging isole,
puis refaire les parcours des clients exacts et les scenarios avec Stripe simule.
Un test avec compte Stripe de test requerra une autorisation distincte.
Verifier l'inventaire historique, les devises et les alertes de reconciliation.

Un retour au binaire de production d6107db retablirait les failles corrigees,
notamment les sessions multiples. Apres creation des premieres tentatives,
preferer un correctif ou un retour au dernier binaire compatible avec ces tables
et invariants. Si un retour d'urgence ancien est autorise, suspendre les nouvelles
initialisations de paiement pendant la reconciliation. Conserver les tables
additives, tentatives et ledgers: ne pas supprimer des traces ou reutiliser des
cles. Aucun rollback ou changement de service n'a ete execute.

Attendre une autorisation explicite pour toute autre phase.
