# Staging local — démarrage et guide manuel

## Restauration historique et transfert automatique - 5 octobre 2026

Pour tester le nouveau canal entre les deux origines locales, sans appairage manuel :

```powershell
node tools/staging/start.cjs --automatic-handoff
```

Store : http://127.0.0.1:5173/catalog ; Checkout : http://127.0.0.1:5174/.
Le lanceur active explicitement VITE_AUTOMATIC_HANDOFF dans les deux applications
et desactive le transfert commun pour ce mode. Le mode sans option reste conserve.
Le canal ouvre une nouvelle fenetre depuis le clic Store, avant les awaits.
Autoriser les popups pour ces seules origines de test. Aucun token dans les URLs.

Utiliser un nouveau profil de test et un nouveau run sans effacer les anciens.
Choisir stage-001 M/Blue, une unite, STAGE10, puis verifier EUR 9,90.
Cliquer Proceder : verifier le spinner historique, la fenetre Checkout,
l'autorisation scoped sans copie/code et le montant EUR 9,90. Recharger Checkout
pendant le transfert ; la meme reference et le meme credential doivent reprendre.
Verifier popup bloque, fermeture, origine incorrecte, autre commande et timeout :
blocage explicite, aucun ordre ou paiement cree pour contourner l'erreur.
Payer uniquement dans le simulateur local puis confirmer depuis le backend.
Verifier meme session, retour exact, consommation stock/remise unique et panier
Store conserve jusqu'a lecture PAID autorisee. Ne pas copier les headers sensibles.

Le Mirror Shop retrouve ses cinq mockups et son propre panier historique. Son
paiement autonome reste explicitement bloque : aucune facturation d'un prix client
ni mapping de variante invente. Ce point interdit de declarer la restauration
fonctionnelle complete. Les tests HTTP/VM ne remplacent pas les clics navigateur.
Tester desktop et mobile, cartes/hover/navigation, spinner, reload/retour/fermeture,
stockage indisponible et COOP/popup. Aucun navigateur disponible dans cette session.
Voir FINAL_HISTORICAL_PARITY_VALIDATION.md pour les limites et le rapport final.

Les outils de ce dossier utilisent uniquement des données synthétiques, PostgreSQL
sur 127.0.0.1 et un Stripe simulé. Aucun déploiement public.
La correction limitée du contrôle d'URL Checkout autorise le simulateur uniquement
dans le serveur Vite local en mode staging explicitement configuré. Tous les builds
de production le refusent. Le parcours UI reste NON VALIDÉ dans un navigateur.
Ne pas désactiver une politique de sécurité pour terminer le test.

## Prérequis et démarrage

Depuis C:\Users\hp\Desktop\work\magic city\Magic_city_git :

```powershell
node tools/staging/validate.cjs
node tools/staging/start.cjs
```

Prérequis : Node installé, PostgreSQL 17 dans
C:/Program Files/PostgreSQL/17/bin, dépendances déjà présentes dans les trois
worktrees. Le premier contrôle reconstruit le backend et valide les frontends.
Le second garde les serveurs ouverts ; Ctrl+C arrête les trois processus Node
et PostgreSQL. Aucun fichier ni cluster n'est supprimé.

| Composant | URL |
| --- | --- |
| Store | http://127.0.0.1:5173/catalog |
| Collection synthétique | http://127.0.0.1:5173/collections/staging |
| Checkout | http://127.0.0.1:5174/checkout-landing?orderId=REFERENCE_PUBLIQUE |
| Checkout préfixé (phase B, routage seulement) | http://127.0.0.1:5173/checkout/ |
| Confirmation préfixée | http://127.0.0.1:5173/checkout/order-confirmation |
| API | http://127.0.0.1:4100/api |
| Santé staging | http://127.0.0.1:4100/__staging/health |
| Stripe simulé | http://127.0.0.1:4101/session/REFERENCE_SESSION_SYNTHETIQUE |

Ne pas remplacer 127.0.0.1 par localhost : les origines autorisées sont EXACTES.
Ne pas copier de jeton dans une URL, la console, un rapport ou une capture.

Phase C : le Store local 5173 ouvre automatiquement /checkout/checkout-landing
 dans le même onglet, après publication cohérente de son accès en sessionStorage.
Le Checkout vérifie cet accès auprès du backend. Phase D : le paiement simulé est désormais disponible ; le retour reste sous
/checkout/order-confirmation sur 5173, sans appairage. Voir
[rapport et guide phase D](COMMON_PAYMENT_VALIDATION.md).
Le Checkout historique 5174 conserve son appairage manuel et ses retours.
Voir [rapport phase C](COMMON_ACCESS_VALIDATION.md).

Contrôles supplémentaires :

```powershell
node tools/staging/common-origin-validation.cjs
node tools/staging/start.cjs --verify
```

Le second exécute les 26 scénarios, dont les 24 historiques puis six contrôles HTTP de routage.
Voir [rapport phase B et tests navigateur](COMMON_ORIGIN_VALIDATION.md).

Pour lancer les vérifications API automatisées sur un cluster NEUF puis arrêter :

```powershell
node tools/staging/start.cjs --verify
```

Pour reprendre un cluster conservé, avec ses commandes, grants, remises et
sessions simulées (utiliser le nom affiché à l'arrêt) :

```powershell
node tools/staging/start.cjs --resume=run-1791105404656
```

Pour vérifier sa reprise via API puis arrêter, après un --verify réussi :

```powershell
node tools/staging/start.cjs --resume=run-1791105404656 --verify
```

La reprise ne réinitialise aucun produit, compteur, accès ni commande. Un nouveau
run fournit une nouvelle base sans effacer les précédentes. Ne pas utiliser une
nouvelle base pour prétendre reprendre une tentative de l'ancienne base.

## Isolation et variables

Le launcher conserve seulement PATH/Path/SystemRoot/TEMP/TMP du shell.
DATABASE_URL, JWT et clés de signature Stripe sont synthétiques et construits
dans son processus enfant ; aucun .env de production n'est copié.
Les variables frontends sont injectées explicitement :

- VITE_API_URL=http://127.0.0.1:4100/api
- VITE_PRIMARY_API_URL=http://127.0.0.1:4100/api
- VITE_CHECKOUT_ORIGIN=http://127.0.0.1:5174
- VITE_STORE_ORIGIN=http://127.0.0.1:5173
- VITE_LOCAL_STRIPE_ORIGIN=http://127.0.0.1:4101 (Checkout uniquement)

Le simulateur exige MODE=staging, DEV=true, PROD=false et une page Checkout sur
http://127.0.0.1:5174. Aucun build de production, même --mode staging, ne l'accepte.
La configuration ne provient jamais d'une URL, d'un message ou d'une réponse API.
Contrôle des vrais bundles Vite de production et lint des fichiers corrigés :

```powershell
node tools/staging/payment-url-validation.mjs
```

Vite utilise un envDir dédié vide, hors des .env applicatifs. Les builds de
validation sont écrits dans .runtime/validation-*/build-store et build-checkout.
Backend CHECKOUT_APP_URL et URLs succès/annulation pointent au Checkout local.
handoffOrigins est injecté directement dans createApp ; accès invité obligatoire
non activé, email non configuré, livraison inactive.

La base magic_staging, rôle magic_staging, a un port aléatoire sur loopback.
Les migrations Prisma existantes sont appliquées à cette base neuve exclusivement.
Le simulateur ajoute son schéma staging_simulator, indépendant du modèle métier,
pour persister les sessions et clés de simulation à travers un redémarrage.
Le fichier .runtime/run-*/staging-environment.json contient les références locales.
Le fichier scenario-private.json du --verify contient uniquement des credentials
SYNTHÉTIQUES pour le test de reprise ; il est ignoré par Git, hors des logs et
réponses publiques. Ne pas partager ce fichier. Il n'est pas un stockage client.

Tous les serveurs écoutent sur 127.0.0.1. PostgreSQL de test utilise trust :
réservé au poste de test, pas à un serveur partagé ou à la production.
Aucun email réel, purge ou tâche automatique d'expiration.

Le staging ajoute une CSP restrictive aux pages pour bloquer les images Shopify,
Google Fonts et autres ressources distantes déjà présentes dans les applications.
Images produits locales disponibles ; logos et médias marketing distants peuvent
manquer. Nonce statique SYNTHÉTIQUE réservé au harness Vite local, sans prétention
de politique CSP de production. COOP/COEP et politiques déployées restent inchangés.
Ne pas cliquer les liens sociaux/externes dans ce test ; ne pas relâcher la CSP
si un composant échoue, noter le résultat pour examen.

## Fixtures

Base neuve : 40 produits stage-001 à stage-040, collection staging.

| Variante | Prix EUR | Stock physique initial |
| --- | --- | --- |
| M / Blue | 11,00 | 5, sauf stage-040 : 1 |
| L / Red | 99,90 | 2 |

STAGE10 : 10 %, deux utilisations maximum.
STAGE-LAST : 1 EUR fixe, une utilisation maximum.
La commande historique synthétique stage-legacy a total 12,34 EUR et n'a
ni réservation ni jeton. Le simulateur n'affiche et ne collecte aucun numéro de carte.

Après --verify, certains stocks/codes sont réservés ou consommés intentionnellement.
Pour un scénario manuel de départ propre, utiliser un nouveau run et un profil
navigateur NEUF réservé au staging ; conserver les profils et tentatives existants.
Ne pas vider sessionStorage/localStorage pour contourner un état incertain.

## Parcours manuel historique sur 5174 — non exécuté ici

Aucun navigateur accessible via les outils (apps=[] et browsers=[]).
Exécuter dans Chrome/Edge/Firefox desktop, puis Safari iOS/Chrome Android si un
environnement loopback accessible sûr est disponible. 127.0.0.1 sur un téléphone
désigne LE TÉLÉPHONE : ce launcher n'expose pas le poste sur le LAN. Sans harness
mobile local adapté et explicitement autorisé, les tests sur appareil physique
restent NON VALIDÉS. Le viewport mobile desktop n'est pas un test Safari iOS.

1. Ouvrir Store /catalog dans le profil de staging. Vérifier deux pages et total 40,
   recherche stage-040, filtres M/Blue, tri prix. Retour/avance ne mélange pas les pages.
2. Ouvrir la fiche stage-001 ; choisir M puis Blue. Prix exact 11,00 EUR,
   stock 5. L/Red doit afficher 99,90, pas le prix M. Ajouter UNE unité.
3. Panier : renseigner Synthetic Staging, test@example.invalid, Test Street 1,
   Synthetic, 00000, IT. Appliquer STAGE10. Attendre preview puis confirmer.
   Attendu : subtotal 11,00, remise 1,10, livraison 0, total 9,90.
4. Cliquer Procéder une fois, puis double clic dans une autre tentative de test.
   Vérifier une seule commande pour la même tentative. Le panneau de transfert
   apparaît après contrôle du total. Ne pas supprimer les données du panier.
5. Cliquer Ouvrir Checkout sécurisé. Origine 5174, orderId public dans query,
   aucun credential. Préparer l'appairage. Copier seulement sa référence publique.
6. Retourner au Store, saisir la référence, inspecter, comparer le code de contrôle
   avec l'onglet Checkout exact, puis autoriser explicitement.
7. Checkout : Vérifier autorisation. Attendu : ordre attendu, total 9,90 EUR,
   état PENDING. Ne pas autoriser une autre fenêtre dont le code ne correspond pas.
8. Cliquer Payer : navigation vers http://127.0.0.1:4101/session/cs_stage_...
   Le sessionId doit avoir été enregistré avant navigation. Aucun jeton dans l'URL.
   Si la configuration manque, l'URL doit être refusée sans enregistrer de session.
9. Cliquer le bouton de paiement SIMULÉ sur la page locale ; aucun numéro de carte.
   La page conserve no-referrer et utilise fetch en mode cors, sans formulaire POST.
   Le serveur exige Origin=http://127.0.0.1:4101 et X-Simulator-Token, preuve signée
   temporaire liée à CETTE session. Aucun justificatif dans l'URL ni dans une capture.
   Le webhook signé finalise le backend. Ne jamais utiliser un vrai Stripe.
   Réponse perdue : réessayer le même bouton ou recharger la même page/session ;
   aucune nouvelle commande ou session. La preuve expire après quinze minutes :
   recharger renouvelle la preuve de page, pas la session ni la réservation.
10. Retour sur /order-confirmation : confirmer la même session et la même commande,
    afficher PAID et 9,90 EUR. Le panier Store reste présent avant confirmation ;
    il ne se vide qu'après sa lecture backend autorisée constatant PAID.
    Reload, retour Store et reprise doivent conserver la tentative et le credential.

Ne pas injecter de faux état paid, modifier sessionStorage ou désactiver le contrôle
de session pour passer le test. Les 24 scénarios HTTP/API automatiques, dont le
module Checkout réel contre le backend isolé, ne valident pas ces clics navigateur.

## Matrice d'échecs manuelle

Utiliser uniquement les commandes SYNTHÉTIQUES de ce run.

| Action | Résultat attendu |
| --- | --- |
| Double clic création / paiement | Même tentative, ordre et session active, boutons bloqués en cours |
| Reload Store après perte de réponse | Même clé, corps figé et jeton ; aucun recalcul silencieux |
| Modifier formulaire après timeout | Reprise du corps sauvegardé, pas du formulaire modifié |
| Fermer Checkout avant appairage | Même ordre ; nouveau grant seulement via nouveau parcours explicite |
| Fermer Store avant accord | Aucune approbation automatique ; récupération vérifiée si accès perdu |
| Reload Checkout après accord | Credential scoped conservé ; pas de repli anonyme |
| Copier pairing d'une autre commande | Refus ; aucune liaison croisée |
| Dépasser cinq minutes avant accord | 410 ; renouvellement explicite après vérification serveur |
| Accord acquis puis réponse perdue | Rédemption retrouve l'accord, sans rotation du jeton |
| Grant révoqué / expiré | 401 ; assistance/récupération, aucun ordre neuf |
| Retour Stripe d'une autre session | Blocage ; aucun succès déduit de l'URL |
| Stock dernière unité concurrencé | Un gagnant, autre 409 VARIANT_OUT_OF_STOCK |
| Dernière remise concurrencée | Un gagnant, autre 409 DISCOUNT_UNAVAILABLE |
| Commande historique stage-legacy | Total conservé ; /pay bloqué LEGACY_RESERVATION_REVIEW |
| 429 | Attente Retry-After conservée, pas de boucle automatique |
| Mode offline pendant paiement | Budget borné et même orderId/sessionId ; pas de rotation |
| Stockage indisponible | Blocage avant mutation, aucun credential dans l'URL |
| Contextes indépendants A/B | Aucun accès par credential A à B |
| Nouvel onglet sans stockage | Appairage/récupération, pas d'autorisation sur orderId seul |

Les fautes réseau sont disponibles UNIQUEMENT dans ce backend loopback :
POST /__staging/faults avec un objet contenant un des flags intentBefore,
intentAfter, payBefore, payAfter, stripeBefore, stripeAfter, simCompleteAfter à true.
Elles sont consommées une fois. Ne jamais viser une API publique pour ces essais.
Les contrôles refusent les origines externes ; aucun token nécessaire pour
ces outils de simulation locaux. Ne pas les déployer.

simCompleteAfter coupe une seule réponse après paiement simulé et webhook.
Le POST /session/:id/complete exige toujours l'origine exacte du simulateur,
y compris pour les replays. Origin absent, null, Store, Checkout ou ressemblant
est refusé. GET de session inconnue : 404 ; preuve absente, expirée ou liée à une
autre session : 403 ; session impayée expirée : 409.
La ledger est verrouillée dans PostgreSQL ; répétitions et concurrence réémettent
le même événement de paiement, finalisé une seule fois par le backend.
Cette preuve de page protège le simulateur synthétique loopback, pas un service
de paiement public : quelqu'un pouvant consulter sa page peut obtenir sa preuve.
Les endpoints de fautes et d'événements restent des outils locaux de test.
Ne pas les exposer sur le LAN ou un hébergement partagé.

L'ancien formulaire avec no-referrer pouvait envoyer Origin:null et déclencher
STAGING_ORIGIN_DENIED. Le refus reste volontaire : il n'est pas contourné par une
exception null ou une suppression de no-referrer.

Captures et rapports : masquer les en-têtes sensibles, ne pas copier un credential.
Vérifier Network/console/referer/analytics : pas de jeton dans query/hash/logs.
Les garanties de transfert inter-origines, de stockage mobile et d'absence de fuite APM
ne peuvent pas être certifiées par les seuls tests API.

## Compatibilité des parcours — phase E

Voir [matrice, diagnostic et validation finale](CHECKOUT_COMPATIBILITY_VALIDATION.md).
Les tentatives historiques ne sont pas transférées automatiquement. Les associations
communes déjà publiées sont conservées. Ne pas utiliser une nouvelle commande
pour résoudre un conflit de session ou un panier courant différent de la demande figée.

## Parcours final local (5 octobre 2026)

La cible finale utilise une navigation normale dans le meme onglet et un ticket
serveur ephemere. Le Mirror Shop est uniquement une simulation frontend : son
bouton final ne cree ni commande ni paiement, et conserve son panier USD.

Depuis Magic_city_git :

```powershell
node tools/staging/start.cjs --final-flow --verify
node tools/staging/start.cjs --final-flow
```

Le premier utilise un nouveau cluster synthetique, verifie le nouveau protocole
et arrete ses propres processus. Le second reste ouvert jusqu'a Ctrl+C. Tous les
clusters sont conserves. Pour garder une tentative existante, reprendre son run
avec --resume=run-... et --final-flow ; ne pas changer de base pour la reprendre.
Les commandes/scenarios historiques restent disponibles sans --final-flow.
--automatic-handoff est un harness anterieur, pas le happy path final.

Store : http://127.0.0.1:5173/catalog. Checkout : http://127.0.0.1:5174/.
API et simulateur restent sur 4100 et 4101. --final-flow exige un guest access
valide pour les lectures/paiements ; aucun acces par orderId seul. Le launcher
injecte VITE_NAVIGATION_HANDOFF_ENABLED=true dans les deux applications et une
cle NAVIGATION_HANDOFF_SECRET strictement synthetique dans le backend. Les builds
publics staging peuvent activer ce flag uniquement avec MODE=staging. Le build
production normal le desactive ; le simulateur reste DEV seulement.

Livraison serveur : 5,00 EUR si subtotal marchandises AVANT remise <200,00 EUR,
sinon zero. Exemple stage-001 M/Blue, STAGE10 : 11-1,10+5,00 = 14,90 EUR.
Le seuil gratuit de 200,00 EUR reste gratuit meme apres une remise. Aucun ancien
ordre n'est recalcule. La livraison est representee par total-(originalTotal-
discountAmount) ; les snapshots existants restent immuables. Aucune migration
livraison. Stripe conserve une ligne agregee sans composition produits.

Le ticket temporaire est dans le fragment uniquement ; le bootstrap HTML retire
ce fragment avant les modules. Ne pas copier la reference ou les credentials.
Une perte de reponse reprend la meme commande, cle et grant destinataire. Un
ticket expire avant redemption bloque explicitement ; aucun nouvel ordre de secours.

Verification manuelle desktop/mobile : navigation meme onglet sans opener,
spinner historique, pagination clavier/touch/loading, quantites/variantes/remise,
14,90 EUR dans Checkout/simulateur/confirmation, refresh et retour Store. Ajouter
un article avant le retour : le panier modifie doit etre conserve integralement,
y compris lors d'une modification puis restauration des memes quantites. Seul
un panier identique sans modification depuis creation peut etre vide apres PAID
verifie avec le grant. Pour les anciennes tentatives sans snapshot, conserver.

Mirror : cinq offres, USD, ajout/quantites/suppression/persistance ; clic final
sans fetch, navigation paiement ni succes invente. Tester expiration, autre ordre,
autre destinataire, reload pendant redemption, reponses perdues et conservation
des sessions. Network/console : aucun credential durable ou PII dans URL/logs.
Pas de HAR brut ni copie des stockages. La CSP locale bloque les images externes
historiques : leur rendu distant n'est pas certifie par le harness loopback.

La migration locale 20261005120000_add_navigation_handoff n'a ete appliquee
qu'aux nouvelles bases locales isolees des tests. Render reste hors scope.
Avant tout futur deploy : revue/migration distante explicitement autorisee,
cle dediee stable, flags coordonnes, CSP du bootstrap et validation navigateur.

Rapport final : [FINAL_STAGING_UI_SECURITY_VALIDATION.md](FINAL_STAGING_UI_SECURITY_VALIDATION.md).
