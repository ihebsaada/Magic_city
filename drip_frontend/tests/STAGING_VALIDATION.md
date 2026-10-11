# Staging Magic City Drip — rapport de validation

Validation du 4 octobre 2026 (Africa/Tunis). Aucun paiement réel, service/base de
production, déploiement public, email réel, commit, push, merge ou switch de branche.

## Résultat

| Contrôle | Résultat |
| --- | --- |
| Backend + PostgreSQL réel synthétique + deux origines frontends + simulateur local | PASS préparation et démarrage HTTP |
| Migrations Prisma isolées, generate/validate | PASS |
| TypeScript et builds backend, Store, Checkout | PASS |
| Contrats backend synthétiques | PASS — 29 |
| Suites PostgreSQL complètes, pont inclus | PASS — 190 |
| Store | PASS — 83 |
| Checkout | PASS — **23** |
| Total suites applicatives | PASS — 325, zéro échec/test ignoré |
| Scénario staging via HTTP/API réels | PASS — 18 vérifications groupées |
| Reprise du même cluster après redémarrage | PASS — mêmes commandes/clé/corps/token/session ; compteurs inchangés |
| Benchmark catalogue existant | PASS réexécuté ; artefact historique restauré à l'identique |
| Lint outillage staging et fichiers applicatifs d'intégration contrôlés | PASS |
| git diff --check et branches conservées | PASS |
| Navigateur desktop/mobile réellement exécuté | NON EXÉCUTÉ — apps=[] et browsers=[] |
| Parcours UI complet Store → Checkout → paiement local → confirmation | **BLOQUÉ / NON VALIDÉ** |
| Protection obligatoire / frais de livraison / transport email réel | NON ACTIVÉS |

Les 18 vérifications sont des scénarios API, pas dix-huit parcours navigateur.
Le protocole HTTP réel, PostgreSQL et les webhooks signés sont exercés ; clics,
sessionStorage entre onglets, affichage React et comportement mobile ne le sont pas.
Les suites clients simulent fetch et le renderer ; elles ne remplacent pas ce contrôle.

Le nombre Checkout exact est 23, confirmé par la sortie du runner relancé.
Le tableau ancien indiquait 22 et total 324 ; il omettait le dernier test
« late rate-limit response cannot erase a session saved by a concurrent operation ».
Les deux cellules de STORE_CHECKOUT_HANDOFF.md sont corrigées à 23 / 325.
Aucun test n'a été retiré ou ignoré pour obtenir le résultat.

## Environnement reproductible

[Guide de démarrage et matrice manuelle](../../tools/staging/README.md).

Depuis le workspace Store :
```powershell
node tools/staging/validate.cjs
node tools/staging/start.cjs
```

Store http://127.0.0.1:5173/catalog ; Checkout http://127.0.0.1:5174/checkout-landing ;
API http://127.0.0.1:4100/api ; simulateur http://127.0.0.1:4101.
Origines distinctes par ports, explicitement autorisées. Aucun cookie inter-origines.

Vérifications API automatiques et arrêt :
```powershell
node tools/staging/start.cjs --verify
```

Reprise du dernier cluster synthétique conservé :
```powershell
node tools/staging/start.cjs --resume=run-1791105404656
```

Les modes --verify et --resume=... --verify arrêtent leurs processus et PostgreSQL.
Le mode manuel reste ouvert jusqu'à Ctrl+C. Les données ne sont pas supprimées.
Les clusters précédents et tentatives existantes sont conservés.

Variables staging injectées par les outils, sans .env applicatif/production :
DATABASE_URL sur un port PG aléatoire, rôle/base magic_staging ; valeurs Stripe/JWT
synthétiques ; VITE_API_URL/VITE_PRIMARY_API_URL local4100 ;
VITE_CHECKOUT_ORIGIN local5174 ; VITE_STORE_ORIGIN local5173.
URLs Stripe de retour locales. Logs sans URLs métier ni credentials.
Le simulateur stocke sa ledger dans staging_simulator au sein de cette base isolée.
Aucune migration métier supplémentaire dans cette phase.

Fixtures : quarante produits, combinaison M/Blue 11,00 EUR et L/Red 99,90 EUR,
stocks finis, collection staging, codes STAGE10 limité à deux et STAGE-LAST à un.
Legacy stage-legacy sans réservation ni accès. Aucun numéro de carte demandé.

Le staging bloque les ressources distantes par CSP : les médias Shopify et polices
Google du code existant peuvent ne pas s'afficher. Cela prévient les connexions
de ressources à la production ; aucun changement de COOP ni assouplissement des
politiques déployées. Ce harness CSP local n'est pas une certification CSP de prod.

## Scénarios API démontrés

- Catalogue au-delà du 24e produit, collection, paramètres réellement injectés
  dans les modules Vite, variantes exactes et prix/stock.
- Preview et création : 11,00 - 1,10 = 9,90 EUR, frais nuls ; une réservation de stock
  exact et une utilisation de remise réservée.
- Même clé/corps/jeton et appels concurrents : une commande.
- Perte réseau avant création : aucun ordre ; reprise explicite même clé.
- Perte de réponse après commit : même réponse/commande sur replay.
- Appairage inspecté et approuvé avec token source ; recipient préparé scoped
  seulement après accord. Mauvaise origine, autre commande, token absent,
  pairing expiré/révoqué : refus. Aucune capacité dans une URL.
- Timeout simulé avant création Stripe, après réussite distante et après réponse
  /pay : reprise avec une seule session persistante locale.
- Webhook signé et confirmation concurrents : une finalisation, stock consommé
  une fois, remise consommée une fois ; les deux credentials relisent PAID / EUR 9,90.
- Webhooks répétés et expiration tardive : aucun retour vers impayé.
- Dernière unité exacte et dernière remise : un gagnant, un refus transactionnel.
- Legacy : 12,34 inchangé ; paiement bloqué pour revue de réservation.
- Signature invalide et jeton en query refusés ; réponses non autorisées sans secret.
- CORS strict du pont et préflight, limite locale 429 et Retry-After ;
  contrôle staging refusant Origin externe.
- Logs de staging : aucune occurrence des access tokens synthétiques générés.
- Redémarrage : rejouer les demandes figées de deux ordres existants et confirmer
  la session déjà payée ne crée aucun ordre/session ni nouvel incrément de remise.

Les états partagés entre pages de catalogue restent soumis à la pagination offset.
Origin ne remplace pas une preuve d'autorisation. Les anciens endpoints invités
gardent le mode compatible : une requête minimale SANS token peut rester admise.
Ce comportement est attendu ici pour préserver la transition, pas une protection
obligatoire validée ou déjà active. /api/orders public reste refusé sans JWT Admin.

## Blocage documenté AVANT modification métier

Fichier concerné :
Magic_city_checkout_security/seamless_checkout_flow/src/lib/secureCheckout.ts,
fonction pay(), condition de validation de l'URL de réponse.

Le simulateur renvoie http://127.0.0.1:4101/session/cs_stage_...
Le Checkout n'autorise que HTTPS avec hostname checkout.stripe.com et refuse donc
PAYMENT_SESSION_INVALID AVANT d'enregistrer sessionId. Il peut exister une session
simulée backend stable malgré ce refus. Le retour UI de confirmation ne peut pas
être validé normalement sans sessionId enregistré.

Aucune correction de cette condition n'a été effectuée. Aucun remplacement par
une URL Stripe réelle, faux paid dans l'UI, injection de sessionStorage, intercept
contournant le garde ou changement de politique navigateur n'est utilisé.

Proposition à autoriser :
- Une destination de simulation explicite uniquement pour un build staging,
  avec origine frontend loopback et simulateur EXACT http://127.0.0.1:4101.
- Pas de valeur issue d'une query/message/réponse comme nouvelle origine autorisée.
- Garde production existant conservé ; aucune acceptation globale HTTP/wildcard.
- Tests montrant refus en production, refus des origines ressemblantes et acceptance
  uniquement du simulateur connu en staging.
- Après accord, relancer le parcours navigateur et conserver sessionId avant navigation.

## Fichiers de cette phase

Uniquement outillage et documentation sous Magic_city_git :
- tools/staging/start.cjs : isolation, migrations, lancement, arrêt et reprise.
- tools/staging/backend.cjs : app test, fixtures, client Stripe simulé persistant,
  page locale, signature webhook, fautes réseau ; jamais monté par server.ts.
- tools/staging/frontend.mjs : Vite local/builds avec envDir isolé, variables et CSP.
- tools/staging/scenario.cjs : dix-huit scénarios HTTP/API groupés.
- tools/staging/resume-smoke.cjs : reprise après redémarrage.
- tools/staging/validate.cjs : contrôles complets reproductibles et conservation
  de l'artefact benchmark existant.
- tools/staging/.gitignore, README.md.
- tools/staging/STAGING_RESULTS.json, STAGING_RESTART_RESULTS.json,
  VALIDATION_RESULTS.json : résultats sans credential.
- drip_frontend/tests/STAGING_VALIDATION.md : présent rapport.
- drip_frontend/tests/STORE_CHECKOUT_HANDOFF.md : deux compteurs rectifiés.

.runtime/ est ignoré par Git. Il contient des clusters/logs/builds synthétiques
et un fichier PRIVÉ de credentials synthétiques nécessaires aux replays API ;
il n'est pas publié, servi ou recopié dans les rapports. Ne pas le partager.

Aucun fichier métier du Store, du backend, du Checkout ou de l'Admin modifié.
Build backend / Prisma client régénérés localement, résultats ignorés par Git.
Toutes les migrations s'exécutent dans les bases de test seulement.
Les trois branches et HEAD d'origine sont inchangés.

## Risques et validations bloquant la production

1. Paiement UI local bloqué : correction staging décrite ci-dessus requiert accord.
2. Aucun navigateur accessible : parcours réel, deux onglets, reload/fermeture,
   stockage indisponible, retour Stripe et tailles desktop/mobile restent à exécuter.
3. Pas d'appareil mobile réel ; l'écoute loopback n'est pas accessible depuis un
   téléphone sur le LAN. Tout autre exposé local/réseau demande un périmètre explicite.
4. Protection obligatoire non activée et recovery email non configuré :
   perte complète des credentials nécessite une récupération vérifiée encore indisponible.
5. Limitation par processus/IP seulement ; masquage proxy/APM, CSP/XSS production,
   politique de concurrence inter-onglets et UX d'accord restent à examiner.
6. Staging local trust/contrôles de fautes non adapté à un hébergement partagé/public.
   Ne pas déployer cet outillage.
7. Les trois erreurs de lint global Store préexistantes restent hors correction ;
   les fichiers d'intégration et tout le nouvel outillage passent le lint.
8. Aucun résultat ne certifie la latence réseau/images/mobile ou la capacité de production.

Les tests applicatifs passent sans échec. Un échec initial de regex du runner
(échappement Windows) et un bloc catch vide signalé par lint ont été corrigés
dans l'outillage seulement. Le contrôle de lint corrigé est réexécuté séparément,
les suites métier inchangées ne sont pas relancées inutilement.

L'environnement est préparé, les tests API sont validés ; la validation UI complète
reste BLOQUÉE et aucun feu vert de mise en production n'est donné.
