# Backend — préparation Render staging

5 octobre 2026, Africa/Tunis. Préparation locale uniquement. Aucun accès à Render,
à sa base restaurée, à Stripe distant ou à la production. Aucun commit/push/déploiement.

## Résultat PASS/FAIL

| Contrôle | Résultat |
| --- | --- |
| TypeScript / build / Prisma generate et validate | PASS |
| Contrats et configuration staging | PASS — 37 (29 existants + 8 nouveaux) |
| PostgreSQL 18.6 réel, synthétique et isolé | PASS — 190 |
| Total backend | PASS — 227, aucun échec final ou test ignoré |
| Lint des fichiers concernés | PASS |
| Historique/schema de magiccity_db_staging sur Render | NON VÉRIFIÉS — aucune connexion |
| Build Linux Render, navigateur et Stripe test distant | NON EXÉCUTÉS |

Le premier initdb PostgreSQL 18 a échoué sans diagnostic exploitable. Une initialisation
isolée de diagnostic puis la suite complète ont réussi. Aucun cluster supprimé.
Dernier cluster tests/.pg-lot4-1791155233999 arrêté par finally et conservé.
Les résultats sont dans tests/RENDER_PREPARATION_RESULTS.json. Aucun benchmark réécrit.

## Git et diagnostic

Branche backend locale staging/backend créée depuis fix/backend-order-privacy,
HEAD d6107db9221ab746867639c4b99f8c6b2ee8397e. Les fichiers suivis/non suivis ont été
comparés par empreinte avant/après changement de branche : conservés intégralement.
La branche staging/backend n'existe pas encore sur GitHub. Aucun fichier indexé.
Store fix/store-product-loading et Checkout fix/checkout-guest-access inchangés.
main local pointe sur 1d101234a25a128c226a42bc771afc0319040a4b ; c'est une branche
d'intégration différente, pas une base interchangeable avec le backend préparé.
Les références distantes n'ont pas été actualisées. La version réellement déployée
ne peut pas être certifiée par ces seules références locales.

Les lots précédents étaient non commités : pousser seulement le HEAD actuel ne
livrerait pas ces protections. Une livraison future doit inclure leurs sources,
les six migrations additives, les tests et la préparation actuelle, après revue.
Les variables auparavant optionnelles et CORS général n'assuraient pas l'isolation
d'un service staging distinct ; PORT doit être numérique et l'écoute sur 0.0.0.0.

## Changements actuels

- src/runtimeConfiguration.ts : validation avant création des clients, nom de base
  EXACT magiccity_db_staging + hôte explicitement fourni, Stripe sk_test uniquement,
  secret JWT nouveau, origines HTTPS explicites et retours sur Checkout staging.
- src/stagingServer.ts, src/server.ts : entrée dédiée ne pouvant retomber sur le
  démarrage compatible ; PORT Render, 0.0.0.0, erreurs de démarrage sans secrets.
- src/app.ts : /healthz, origines staging explicites, logs HTTP désactivés dans cette
  entrée ; accès invité obligatoire uniquement pour ce NOUVEAU service staging.
  Le démarrage historique hors staging garde son comportement.
- src/controllers/stripeWebhookController.ts : événements live refusés en staging.
- src/services/paymentService.ts : pas de customer_email copié sur les nouvelles
  demandes staging. src/services/stripeClient.ts bloque les anciens requests avec
  customer/customer_email/receipt_email et les sessions live relues en staging.
- src/controllers/adminAuthController.ts, collectionController.ts,
  discountController.ts, productController.ts : erreurs génériques dans les logs.
- package.json : scripts prisma:generate et start:staging ; aucune dépendance ajoutée.
- tests/run-tests.cjs, tests/runtime-staging.test.cjs : contrats fail-closed, CORS,
  santé, accès, signatures live et blocage des destinataires copiés.
- tests/run-postgres-tests.cjs : PG_TEST_BIN configurable, défaut PostgreSQL 17 inchangé.
- .gitignore : diagnostics et scripts temporaires locaux ignorés.
- .env.staging.example, RENDER_STAGING.md, tests/RENDER_PREPARATION_RESULTS.json.

Aucune nouvelle migration dans cette phase. Les migrations des lots antérieurs
restent intactes. Aucun seed/import/reset/anonymisation exécuté sur la base copiée.
Les scripts Shopify/import/seed existants ne font pas partie du démarrage autorisé.

## Formulaire Render proposé — ne pas lancer encore

| Champ | Valeur |
| --- | --- |
| Projet / environnement | MagicCity-Staging / Staging |
| Source | GitHub, https://github.com/ihebsaada/Magic_city.git |
| Branch | staging/backend — publication soumise à autorisation |
| Name | MagicCityStagingBackend |
| Runtime / plan | Node / Free |
| Root directory | drip_backend |
| Build command | npm ci --include=dev && npm run prisma:generate && npm run build |
| Start command | npm run start:staging |
| Health check path | /healthz |
| Auto deploy | Off |
| Region | Même région que magiccity_db_staging, à vérifier dans le dashboard |

NODE_VERSION=24.19.0 correspond au Node local testé. Render fournit PORT (10000
par défaut) ; ne pas imposer le port local 4000. /healthz est une liveness statique,
PAS une preuve de disponibilité PostgreSQL ou de migrations appliquées.

Reporter les variables de .env.staging.example dans les secrets du NOUVEAU service,
pas dans Magic_city. Remplacer tous les exemples par les valeurs staging exactes.
DATABASE_URL : Internal Database URL de magiccity_db_staging uniquement ;
STAGING_DATABASE_HOST : hostname exact de cette URL, sans schéma/port/chemin.
Aucun fallback vers magiccitydb_3334. Aucun secret de production recopié.
Créer JWT et Stripe TEST dédiés ; whsec seul ne prouve pas le mode test du webhook :
vérifier son rattachement au compte/environnement test. Pas de STRIPE_API_VERSION.
Aucun email réel : recoveryDelivery reste absent ; vérifier aussi les notifications
Stripe TEST et n'utiliser que des destinataires synthétiques example.invalid.

Les URL HTTPS Store/Checkout/API staging restent à choisir. CHECKOUT_APP_URL est
la base Checkout sans slash final ; pour origine commune, suffixe /checkout.
Les clients actuels n'activent le parcours automatique que dans DEV local : cette
préparation backend ne rend PAS les bundles frontend prêts pour Render staging.
La destination d'une nouvelle session doit être choisie explicitement avant usage ;
ne jamais réécrire les requests/retours des sessions restaurées.

## Migrations de la base restaurée — procédure future distincte

La présence de _prisma_migrations ne prouve pas une correspondance de schéma.
Avant tout déploiement, sous autorisation de connexion staging seulement :
1. Vérifier hôte, nom de base, service cible et sauvegarde dédiée staging.
2. Inspecter en lecture seule migration_name, checksum, finished_at, rolled_back_at,
   applied_steps_count de _prisma_migrations ; comparer aux fichiers historiques.
3. Exécuter prisma migrate status avec le client verrouillé local, examiner le schéma
   effectif et les éventuels échecs/drifts. Ne pas exporter les lignes personnelles.
4. Si historique/checksums/schema concordent, examiner les seules migrations pending.
   Les six additives ne doivent pas être supposées absentes ou toutes à rejouer.
5. Après autorisation séparée, npm run prisma:migrate:deploy avec DATABASE_URL
   staging validée. Arrêter en cas de conflit ; aucun migrate resolve automatique.

Ne pas utiliser migrate dev, reset, db push, seed ou import sur cette copie.
Ne pas mettre migrate deploy dans Build/Start : il écrirait sans cette revue.
Render Free ne fournit pas de pre-deploy command ; prévoir une exécution contrôlée
séparée après autorisation. Les CREATE INDEX standards peuvent bloquer les écritures.
Les anciens ordres restent sans backfill ; certaines réservations nécessitent une
revue métier et les anciens accès sans grant restent refusés dans ce service strict.

## Risques et autorisations restantes

La copie contient potentiellement noms/emails/adresses, mots de passe hachés,
commandes, grants actifs et anciennes sessions Stripe. Aucune anonymisation demandée
ou exécutée. Ne pas exposer cette base publiquement : JWT/CORS ne constituent pas
un contrôle d'accès privé complet. Restreindre l'accès staging, vérifier logs/APM,
rotations des secrets, grants copiés, CSP/XSS et politiques de conservation.
Les clés Stripe test ne rendent pas utilisables les sessions live restaurées : blocage
et revue explicites, sans modification silencieuse des commandes ou requests.
La récupération email est indisponible ; l'accès strict peut bloquer des historiques.
Limites locales par processus/IP, cold starts Free et proxy doivent être examinés.
Aucun paiement distant, notification, frais de livraison ou purge activé ici.

Le build Windows et PG18 synthétique sont validés, pas l'installation Linux via npm ci
sur Render ni la compatibilité du schema restauré. Les protections staging sont
conditionnelles à l'entrée dédiée et aux variables validées. Ne pas les substituer
au backend de production. Les domaines de production et l'Admin restent inchangés.

En attente : autorisation commit/push/publication de branche, vérification staging
restauré, décision des origines privées/TLS et déploiement séparément autorisé.
Aucun service Render créé/modifié dans cette phase.

Références officielles :
- https://render.com/docs/web-services
- https://render.com/docs/node-version
- https://render.com/docs/deploys

## Vérifications après un éventuel déploiement autorisé

- GET /healthz : 200 {ok:true}, sans noms de base ni secrets ; vérifier ensuite un
  GET catalogue avec fixtures synthétiques, pas des données client restaurées.
- OPTIONS pont depuis les origines EXACTES : accepté ; origine ressemblante et
  Origin:null : refus. GET minimal sans token : 401, Admin sans JWT : 401.
- Préparer une commande synthétique : même clé/body/token après réponse perdue,
  montant EUR vérifié, réservation exacte, aucun destinataire personnel Stripe.
- Stripe TEST uniquement, webhook signé livemode=false ; live/invalid : refus.
  Répétitions webhook/confirmation : une finalisation et une consommation.
- Anciennes sessions/grants incompatibles : blocage explicite, aucun remplacement.
  Vérifier logs/proxy/APM sans credentials ; ne pas partager HAR brut.

Ces contrôles sont un plan, pas des opérations exécutées sur Render.
