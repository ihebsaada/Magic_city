# Revue des webhooks historiques — réception ≠ paiement

Après signature et mode Stripe vérifiés, une commande existante sans SecureOrderPolicy peut être mise en quarantaine. La transaction verrouille Order sans la modifier, recontrôle l'absence du registre, les références connues et les conflits. Elle enregistre HistoricalWebhookReceipt avec synchronous_commit=on. Le commit précède le HTTP 200 `received=true, commercialProcessing=false, disposition=historical_quarantined, reviewRequired=true`.

Ce 200 confirme uniquement que la livraison a une décision durable ; il ne finalise ni paiement, ni réservation, ni commande. Les callbacks/guest endpoints historiques restent refusés. Les commandes inconnues, registre indisponible/version invalide, conflits et erreurs DB ne sont pas acquittés. Les événements modernes continuent le moteur existant. Signature invalide ou mode contradictoire : 400 avant toute persistance. Production reste bloquée au startup ; LIVE n'est exercé qu'avec signatures/événements simulés localement.

Une ligne PENDING représente une alerte durable dédupliquée, WARNING en TEST et CRITICAL en LIVE. Aucun payload, PII, token, signature ou identifiant complet session/paiement stocké. eventHash/sessionHash/payloadHash SHA-256 ; orderAlias HMAC séparé par domaine avec NAVIGATION_HANDOFF_SECRET existant (pas de nouvelle variable). Un replay identique n'ajoute aucune ligne ; même eventId avec payload différent →409. Ne pas faire tourner la clé de handoff pour résoudre une alerte. Les empreintes restent des métadonnées sensibles, accès opérateur restreint.

## Revue humaine requise

Avant release, désigner un opérateur et un créneau de surveillance des PENDING ; le polling SQL/monitoring externe n'est pas configuré par cette passe. Tant que ce suivi n'est pas validé, NO-GO opérationnel. La persistance fonctionne sans transport email ; aucun envoi tiers automatique. Une alerte ne disparaît pas après ACK ni après redémarrage.

Requête de surveillance READ ONLY, après garde de base staging :

```sql
SELECT "eventHash", "orderAlias", "eventType", livemode, severity, "createdAt"
FROM public."HistoricalWebhookReceipt"
WHERE "reviewState"='PENDING'
ORDER BY "createdAt";
```

Sur CRITICAL/LIVE inattendu ou preuve d'obligation active : STOP la release, alerter l'opérateur via canal approuvé sans payload et lancer une revue fournisseur read-only séparément autorisée. La quarantaine ne résout pas cette obligation, ne rembourse/expire rien et ne doit jamais être interprétée comme preuve d'absence de paiement réel.

Corrélation privée : retrouver l'événement fournisseur par SHA-256 de son identifiant, puis examiner mode, état et montant dans le compte exact sans publier l'identifiant. Ne pas attribuer un droit guest ni compléter le paiement historique. Conserver la décision et les preuves expurgées dans le dossier d'incident. Aucun endpoint de reprocessing automatique ni job de purge.

Le changement PENDING → REVIEWED n'est pas automatisé ni exécuté ici ; il exigera un outil/procédure administratifs audités, responsabilité et autorisation explicites. Ne pas utiliser de SQL ad hoc pour modifier les commandes. Garder les receipts au moins pendant la fenêtre fournisseur de redelivery et les obligations d'audit, à définir avec l'opérateur ; aucune durée inventée ni purge incluse. Un doublon reçu après revue ne réouvre pas artificiellement l'alerte.

Si la persistance est indisponible, 503 et retries fournisseur souhaités : ne jamais ACK en mémoire. Les retries cessent normalement après l'ACK durable ; aucune garantie n'est faite sur le comportement d'un transport qui ignore les réponses ou sur le calendrier fournisseur. Monitoring des 5xx et de l'âge/count PENDING requis, sans logs bruts.
