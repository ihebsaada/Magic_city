# Phase A — paiement du simulateur local

4 octobre 2026, Africa/Tunis. Périmètre : simulateur et outillage staging seulement.

## Rapport actuel

| Contrôle | Résultat |
| --- | --- |
| Reproduction HTTP sur le simulateur actif | PASS — POST avec Origin:null retourne 403 STAGING_ORIGIN_DENIED |
| Cause navigateur exacte de la requête utilisateur | À CONFIRMER — en-tête Network réel non recueilli |
| Backend TypeScript / build / contrats | PASS — 29 tests |
| PostgreSQL réel, suites backend existantes | PASS — 190 tests |
| Store TypeScript / build / tests | PASS — 83 tests |
| Checkout TypeScript / build / tests | PASS — 51 tests |
| Total applicatif réexécuté | PASS — 353, zéro échec/test ignoré |
| Prisma validate | PASS |
| Prisma generate | PASS — relancé après arrêt du staging avec l'environnement synthétique du validateur |
| Lint outillage et fichiers d'intégration existants | PASS |
| Scénarios staging du simulateur corrigé | PASS — 24, zéro échec |
| Navigateur desktop/mobile | NON VALIDÉ — apps=[] et browsers=[] |

Le premier validate.cjs avait terminé avec code 1 à cause du verrou Prisma.
Après arrêt du lanceur par l'utilisateur, les ports 4100/4101/5173/5174 ont été
vérifiés libres et Prisma generate a réussi. Les autres contrôles déjà PASS
n'ont pas été relancés inutilement. Les 24 scénarios ont ensuite tous réussi.
La reprise après réponse perdue vérifie explicitement stock physique et quantité
réservée inchangés, compteur de remise inchangé et une seule finalisation/session.

## Diagnostic confirmé et limites

Le staging existant a été identifié par GET /__staging/health : isolated=true,
stripe=local simulation. Un POST /session/cs_stage_diagnostic_unknown/complete
avec Origin:null retourne 403 STAGING_ORIGIN_DENIED. Le middleware refuse avant
toute lecture ou mutation de paiement ; aucun paiement existant utilisé.

Le code antérieur servait une page no-referrer avec un formulaire POST.
Une navigation POST de formulaire sous no-referrer peut porter Origin:null.
Le middleware refusait cette valeur ; les tests Node sans Origin n'avaient pas
reproduit cette différence. Le mécanisme de refus est confirmé par HTTP, mais
la requête navigateur réellement observée reste à identifier dans Network.
Si l'échec concernait inspect/approve du pont, son code d'erreur serait
HANDOFF_ORIGIN_DENIED : ne pas attribuer automatiquement ce cas au formulaire.

## Correction limitée

- Pas de formulaire POST : bouton et fetch explicite mode:cors, no-referrer,
  no-store, credentials:omit, deadline de quinze secondes.
- CSP à nonce aléatoire par page, connect-src:self et form-action:none ;
  aucun unsafe-inline, politique no-referrer conservée.
- POST complete exige Origin exactement http://127.0.0.1:4101. Origin absent,
  null, Store, Checkout, autre port ou domaine ressemblant est refusé.
- X-Simulator-Token : preuve HMAC SHA-256 liée à la session, nonce aléatoire
  et expiration de quinze minutes. Usage séparé par préfixe de la signature
  webhook synthétique. Vérification de signature avec timingSafeEqual.
- La preuve reste dans la page et l'en-tête, jamais une URL ou un journal.
  Elle ne contient aucun jeton d'accès invité et ne modifie aucune tentative client.
- Vérification du statut et de l'expiration de la session simulée sous verrou
  PostgreSQL FOR UPDATE. Une session déjà payée n'est pas réécrite.
- Webhook signé réémis avec le même identifiant d'événement ; le backend
  conserve ses garanties de finalisation idempotente.
- Erreur webhook : 503 et reprise du même paiement. Réponse perdue :
  même preuve/session, ou reload pour une nouvelle preuve de page seulement.
- Retour JSON historique conservé. La page valide origine Checkout, chemin de
  confirmation et sessionId avant navigation ; aucune URL fournie par l'utilisateur.

Cette preuve protège un simulateur synthétique loopback : quelqu'un pouvant
consulter sa page peut obtenir sa preuve. Ce n'est pas une authentification de
production. Les endpoints d'événements/fautes restent des contrôles locaux de test.
Ne jamais exposer cet outil publiquement ou sur un réseau partagé.
Recharger ne prolonge ni la session Stripe, ni une réservation, ni un grant invité.

## Tests exécutés

scenario.cjs comprend 24 vérifications groupées, incluant :
origine légitime, origines absente/null/incorrectes, preuve absente/falsifiée/expirée,
preuve d'une autre session, session inconnue, session impayée expirée,
deux completions concurrentes avec confirmation, répétitions et réponse perdue
après webhook. Stock, remise et finalisation doivent être consommés une seule fois.
Les scénarios historiques API, idempotence, appairage et reprise restent présents.
Ces 24 tests ont tous réussi contre le processus corrigé. La dernière exécution
utilise .runtime/run-1791117715657 ; processus et PostgreSQL arrêtés par finally,
cluster conservé. Les autres clusters, données et tentatives restent conservés.
PHASE_A_PRISMA_RESULTS.json et STAGING_RESULTS.json enregistrent les résultats
sans credentials. La vérification supplémentaire du stock après réponse perdue
est une assertion de test uniquement, sans changement du simulateur.

## Redémarrage et validation restante

L'utilisateur a arrêté le lanceur précédent avec Ctrl+C. Les ports étaient libres
avant validation ; aucun processus n'a été fermé de force. Les contrôles --verify
arrêtent seulement les processus qu'ils créent et conservent leurs clusters.

Depuis Magic_city_git, une fois les ports libres :

```powershell
node tools/staging/start.cjs --verify
node tools/staging/start.cjs
```

Prisma generate a été relancé avec les valeurs synthétiques du validateur.
Pour reprendre le dernier cluster au lieu de créer de nouvelles données :

```powershell
node tools/staging/start.cjs --resume=run-1791117715657
```

Pour le parcours manuel avec STAGE10 disponible, préférer un nouveau run :
les tests automatisés ont consommé ses deux utilisations dans le cluster validé.
Ne pas effacer les tentatives navigateur ; employer un profil de test neuf pour
une nouvelle base. Le staging manuel reste ouvert jusqu'à Ctrl+C.

Suivre le [guide manuel](README.md), étapes 1–10. Sur la page du simulateur :
clic Payer en simulation, POST fetch avec Origin exact du port 4101, en-tête de
preuve présent, réponse 200, puis confirmation EUR 9,90. Inspecter seulement
les métadonnées de requête ; ne pas copier la valeur de la preuve ou du token invité.
Double clic, retour, reload et perte de réponse doivent garder la même commande
et session. Vérifier une seule consommation de stock/remise et le panier Store
conservé jusqu'à PAID confirmé.

Si le refus persiste, recueillir méthode, origine, chemin avec ID masqué, statut,
code d'erreur et Sec-Fetch-Mode/Site. Aucun HAR brut, cookie, Authorization,
Order-Access-Token ou X-Simulator-Token dans les rapports/captures.

## Fichiers de cette phase

- tools/staging/backend.cjs
- tools/staging/scenario.cjs
- tools/staging/README.md
- tools/staging/VALIDATION_RESULTS.json — résultats des validations réexécutées
- tools/staging/PHASE_A_PRISMA_RESULTS.json — reprise réussie de Prisma generate
- tools/staging/STAGING_RESULTS.json — 24 scénarios PASS
- tools/staging/SIMULATOR_PAYMENT_VALIDATION.md

L'artefact benchmark backend est restauré à l'identique par validate.cjs.
Builds et Prisma générés uniquement comme contrôles locaux ; aucun code métier
Store/Checkout/backend/Admin modifié. Aucun nouveau schéma ou migration métier.
Données et tentatives existantes conservées. Aucun paiement réel, production,
commit, push, merge, déploiement, activation de frais/protection/email.
Phases B à F non commencées.
