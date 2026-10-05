# Variables Render staging — audit du 5 octobre 2026

Configuration uniquement ; aucune base/service Render interrogé ou modifié.
Le modèle .env.staging.example ne contient aucun secret réel et ses domaines
example.invalid ne doivent pas être utilisés comme configuration opérationnelle.

| Variable à renseigner | Source / valeur |
| --- | --- |
| DEPLOYMENT_ENV | staging, entrée npm run start:staging |
| NODE_ENV | production |
| NODE_VERSION | 24.19.0, version locale testée |
| DATABASE_URL | URL dédiée magiccity_db_staging uniquement, jamais production |
| STAGING_DATABASE_HOST | Hôte exact de cette URL, sans port/chemin |
| JWT_SECRET | Nouveau secret aléatoire distinct, au moins 32 caractères |
| JWT_EXPIRES_IN | 1h recommandé ; défaut du code 7d |
| STRIPE_SECRET_KEY | Nouvelle clé dédiée sk_test_... |
| STRIPE_WEBHOOK_SECRET | whsec_... du webhook TEST dédié, pas celui de production |
| STRIPE_CURRENCY | eur explicitement ; défaut eur, commandes stockées EUR |
| STAGING_STORE_ORIGIN | Origine HTTPS exacte future du Store, sans chemin |
| STAGING_CHECKOUT_ORIGIN | Origine HTTPS exacte future du Checkout, sans chemin |
| STAGING_API_ORIGIN | Origine HTTPS exacte du nouveau backend |
| CHECKOUT_APP_URL | Base Checkout sans slash final ; /checkout si origine commune |
| STRIPE_SUCCESS_URL | Confirmation du Checkout staging, placeholders orderId/session_id |
| STRIPE_CANCEL_URL | Landing du Checkout staging, placeholder orderId |

PORT est injecté par Render. STRIPE_API_VERSION doit être ABSENTE (pas recopiée) :
le garde staging refuse les overrides ; le SDK Stripe verrouillé utilise sa version
par défaut. ADMIN_EMAIL et ADMIN_PASSWORD ne sont PAS nécessaires au service en
exécution. Ils ne sont lus que par prisma/seed.ts, qui n'est ni build ni startup.
PG_TEST_BIN est un paramètre de runner local, pas une variable Render. Aucune
variable recovery/email ou de frais de livraison à ajouter. Les origines du pont
proviennent des variables STAGING_* injectées dans createApp, pas d'une query.

## Authentification restaurée : blocage explicite

adminLogin cherche User par email puis bcrypt.compare avec passwordHash en base.
Il ne lit ni ADMIN_EMAIL ni ADMIN_PASSWORD. requireAdminAuth vérifie JWT HS256 avec
le nouveau secret et l'existence du même User/id/email. Changer JWT_SECRET rend les
JWT de production invalides, mais l'email/mot de passe restaurés peuvent encore
obtenir un JWT staging. Le seed ne change pas le mot de passe d'un email existant ;
un autre email créerait une ligne et ne désactiverait pas le compte copié.

La demande d'identifiants Admin distincts n'est donc PAS réalisable uniquement par
variables. Il faudra une autorisation distincte pour provisionner/rotater le compte
staging et traiter le compte restauré, exclusivement dans la base staging. Aucun
seed, modification User, migration ou anonymisation effectué. Ne pas publier le
service en supposant que les variables ADMIN_* isolent l'authentification.

Vérification locale sur contrôleur compilé, bcrypt/JWT réels et ligne User synthétique
simulée : quatre assertions PASS (nouveaux ADMIN_* ne connectent pas, mauvais mot de
passe refusé, mot de passe restauré accepté, JWT signé seulement avec le nouveau
secret). Aucun accès à la base Render ; présence/contenu de son utilisateur réel
NON VÉRIFIÉS. Résultat : tests/STAGING_ENV_AUTH_RESULTS.json. Sources vérifiées :
adminAuthController.ts, requireAdminAuth.ts et prisma/seed.ts.

## URL et blocages restants

Le modèle propose deux origines séparées, compatibles avec le parcours historique.
Pour origine commune, choisir la même origine Store/Checkout et CHECKOUT_APP_URL
avec /checkout ; success/cancel doivent avoir ce préfixe. Le frontend actuellement
préparé n'active l'automatisme que dans DEV local : choisir des URL ne l'active pas
en build Render. Ne pas réécrire les requests ou retours des sessions existantes.

Les nouvelles commandes utilisent STRIPE_CURRENCY ; une session existante utilise
la devise de sa commande et le request persistant, pas une conversion via env.
Renseigner eur n'altère pas les commandes restaurées. Les anciennes sessions live
sont refusées en staging ; aucune session de remplacement créée pour les réparer.

Restent bloquants : URLs HTTPS non créées, identité Admin distincte non provisionnée,
historique Prisma de la copie non inspecté, données personnelles copiées à protéger,
contrôles navigateur/Linux et notifications Stripe TEST à vérifier. Configuration
recovery réelle absente. Le format whsec ne prouve pas le mode TEST : sélectionner
le bon webhook et tester avec données synthétiques sous autorisation séparée.

Aucun code métier modifié dans cette étape. Fichiers ajustés/ajoutés :
.env.staging.example, STAGING_ENVIRONMENT.md, tests/STAGING_ENV_AUTH_RESULTS.json.
Branche locale staging/backend conservée ; aucun commit, push ou déploiement.
