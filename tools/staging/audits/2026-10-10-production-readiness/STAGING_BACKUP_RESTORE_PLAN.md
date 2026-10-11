# Backup / restauration isolée staging — procédure NON exécutée

Périmètre futur exclusivement `magiccity_db_staging`, avec hôte indépendamment confirmé. Aucun accès distant dans cette préparation. Ne pas utiliser les identifiants production ni un `.env` ambigu. Les sauvegardes contiennent des données privées : répertoire hors Git, accès Windows limité, stockage chiffré approuvé, rétention et propriétaire désignés. Ne pas publier archive, URL ou stderr non expurgé.

## Préconditions bloquantes

- PG_STAGING_URL et STAGING_DATABASE_HOST présents dans le processus opérateur ; parser localement PostgreSQL URI, pathname EXACT `/magiccity_db_staging`, hostname EXACT STAGING_DATABASE_HOST, TLS require/verify-full, aucune cible production connue. Refuser immédiatement toute divergence, query de connexion non approuvée ou credentials absents. Ne jamais afficher leurs valeurs.
- Vérifier la base via une connexion read-only et PostgreSQL major 18 ; choisir pg_dump **18** et contrôler sa version avant backup. Pas de pg_dump 17 pour serveur 18.6.
- Arrêter les nouvelles émissions sous autorisation de maintenance ; inventorier obligations TEST et dépendances. Ne pas modifier les anciennes commandes/réservations. Si paiement actif : STOP/revue.
- Aucun script de backup ni de restauration ajouté aux start/build commands Render/Netlify.

## Séquence future à autoriser

1. Inventaire `STAGING_TRANSITION_READ_ONLY.sql`, psql 18 `-X -w -v ON_ERROR_STOP=1 -f`. Environnement enfant dédié : PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE/PGSSLMODE, PGCONNECT_TIMEOUT, PGOPTIONS read-only ; aucun secret dans argv. Refuser variables PG service/options héritées non contrôlées. Hôte et identité revérifiés immédiatement avant chaque connexion.
2. Dump custom complet avec **pg_dump 18**, sans filtre table/schéma et sans données exclues. Exemple d'arguments Windows, APRÈS garde : `pg_dump.exe --format=custom --file=<chemin-local-neuf.dump> --no-password`. Connexion par environnement seulement ; ne pas mettre l'URI après la commande. pg_dump ne fait pas de migration. Ne pas sauvegarder globals/roles ou credentials.
3. Exit code 0 obligatoire ; chemin absolu, taille non nulle, SHA-256 (`Get-FileHash -Algorithm SHA256 -LiteralPath ...`), heure UTC, versions client/serveur et périmètre dans un manifeste privé sans credentials. Échec → STOP ; ne pas déclarer une archive partielle valide et ne rien écraser.
4. Validation structurelle hors réseau : `pg_restore.exe --list <archive>` avec client 18. Cette liste seule ne prouve PAS une restauration.
5. Restauration réelle dans un **nouveau conteneur Docker 18 synthétique/isolé** dédié, jamais une DB Render. Réseau Docker `--network none`, aucune publication de port, stockage local temporaire propre. Ne pas réutiliser un conteneur utilisateur. Le dump est privé même en local ; ne pas le copier dans Git.
6. Exemple PowerShell pour la restauration uniquement (variables locales : `$auditContainer` nom unique contrôlé, `$archivePath` chemin validé) :

```powershell
docker --host npipe:////./pipe/dockerDesktopLinuxEngine run -d --network none --name $auditContainer --tmpfs /var/lib/postgresql:rw -e POSTGRES_USER=restore_operator -e POSTGRES_DB=staging_restore -e POSTGRES_HOST_AUTH_METHOD=trust postgres:18
# Attendre pg_isready via docker exec -h 127.0.0.1 ; serveur définitif uniquement.
docker --host npipe:////./pipe/dockerDesktopLinuxEngine cp $archivePath "${auditContainer}:/tmp/staging.dump"
docker --host npipe:////./pipe/dockerDesktopLinuxEngine exec $auditContainer pg_restore -h 127.0.0.1 -U restore_operator -d staging_restore --exit-on-error --single-transaction --no-owner --no-privileges /tmp/staging.dump
```

Le trust ci-dessus concerne exclusivement ce conteneur sans réseau. Aucune commande `--clean`, aucun DROP ou modification PUBLIC. Contrôler chaque exit code ; en cas d'échec ne pas poursuivre. `--no-owner --no-privileges` adapte la restauration locale, pas l'archive source. Les règles production et rôles distants ne sont pas modifiés.

7. Audit local du restore : compte et distribution Order/OrderItem identiques à l'inventaire, sommes gelées, migrations/checksums, PK/FK/index/validité, dépendances et refus historiques. Le script staging strict refuse `staging_restore` : préparer un audit LOCAL distinct avec garde sur ce nom et ce conteneur, ne pas affaiblir le garde staging. Comparer exports de hashes privés pour les lignes si une preuve complète est requise, sans publier PII. Appliquer les 18 migrations seulement à cette copie après autorisation locale spécifique ; conserver hash historique avant/après. Ne jamais qualifier ce restore de backup production.
8. Arrêter uniquement le conteneur créé dans `finally`, conserver manifeste/rapport ; tmpfs n'est pas une sauvegarde persistante. Ne pas supprimer l'archive. Destruction ultérieure du conteneur/archives selon rétention séparément approuvée.

## Rollback

Une restauration distante serait destructive : elle n'est PAS autorisée ni proposée automatiquement. Le rollback normal est applicatif policy-aware, sans retour de schéma ni effacement de nouvelles commandes. Après activation, ancien backend `c05b810...` interdit comme rollback. Voir `STAGING_BLOCKERS_RESOLUTION.md` pour l'artefact source figé et ses limites. Ne jamais restaurer un dump pré-release au-dessus de commandes créées depuis la bascule sans revue et autorisation distinctes.
