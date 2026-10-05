# Phase D — paiement simulé sur origine commune

Validation du 4 octobre 2026. Phases E et F non commencées.

| Contrôle | Résultat |
| --- | --- |
| TypeScript et builds backend, Store, Checkout ; Prisma generate/validate | PASS |
| Contrats backend / PostgreSQL réel isolé | PASS — 29 / 190 tests |
| Store / Checkout historiques | PASS — 83 / 51 tests |
| Accès commun et paiement, sources compilées et environnement simulé | PASS — 17 tests |
| Total des suites ci-dessus | PASS — 370, aucun échec ni test ignoré |
| Scénarios staging HTTP réel, historiques conservés | PASS — 26 |
| Routage HTTP commun | PASS — 6 |
| Quatre bundles de production : transfert désactivé et simulateur refusé | PASS |
| Lint des fichiers concernés | PASS |
| git diff --check ; branches conservées | PASS |
| Parcours navigateur desktop/mobile | NON VALIDÉ — apps=[] et browsers=[] |

Le validateur complet a exécuté 15 tests communs ; les deux tests supplémentaires
ont ensuite été exécutés dans la suite ciblée finale de 17 tests. Les contrôles
Checkout TypeScript/build/tests ont été relancés après le dernier changement
applicatif. Les builds préfixés, le lint, les bundles de production et les
26 scénarios HTTP ont également été relancés sur ce code final.
Les tests VM/fetch et les scénarios HTTP ne constituent pas un parcours navigateur.

## Comportement

Le bouton de paiement est disponible sur l'instance commune de staging. Avant
chaque /pay, le Checkout relit l'association et vérifie l'accès scoped auprès du
backend. Il réutilise le même ordre et le même credential. Le verrou de promesse
déduplique les clics ; les budgets persistants et les garanties backend restent
en place. Une réponse perdue appelle explicitement /pay sur le même ordre.

La restriction locale du simulateur accepte 4101 depuis le Checkout commun
uniquement sous les mêmes conditions explicites MODE=staging, DEV=true,
PROD=false, flag commun, basename et origine exacts. La configuration vient du
lanceur Vite, jamais d'une réponse ou d'une URL. Production : exclusivement
https://checkout.stripe.com. Identifiants URL, fragments et domaines ressemblants
restent refusés. Le chemin local doit correspondre au sessionId retourné.
Un credential/session modifié pendant la requête provoque un conflit, sans
écrasement. Le sessionId validé est sauvegardé avant navigation.

Dans le seul client Stripe simulé, la première création mémorise sa destination
de retour dans la ledger synthétique : Origin exact 5173 →
http://127.0.0.1:5173/checkout/order-confirmation ; parcours historique → 5174.
AsyncLocalStorage isole cette information entre appels concurrents. Les replays
gardent la destination persistée. Les sessions antérieures sans ce champ gardent
5174. Le middleware staging refuse 409 STAGING_RETURN_CONFLICT lorsqu'une session
existante appartient à l'autre parcours ; il ne la remplace ni ne la réécrit.
Origin choisit seulement une destination fixe : il ne donne aucun accès à l'ordre.
Les endpoints et le code métier backend restent inchangés.

Le simulateur conserve CSP, no-referrer, Origin exact 4101, preuve HMAC liée à
la session et webhook signé. Sa page vérifie la destination attendue depuis
la session persistée avant navigation. Aucun credential n'est dans une URL.

La confirmation existante vérifie l'ordre et le sessionId sauvegardés, appelle
le backend avec le token puis relit le montant EUR et PAID. L'URL ou la réponse
du simulateur n'annonce jamais seule un succès. La logique de confirmation n'a
pas été modifiée. Le panier Checkout est distinct du panier Store ; la suppression
du panier Store reste soumise à sa lecture backend scoped au retour dans le Store.

## Preuves fonctionnelles

Le scénario commun utilise un produit et une remise synthétiques dédiés :
11,00 EUR − 1,10 EUR = 9,90 EUR, frais nuls. Il teste perte de réponse Stripe,
perte de réponse /pay, reload du module avec le stockage conservé, double clic,
session persistée avant départ, refus d'un retour 5174, perte de réponse de
completion, webhook/confirmation concurrents et confirmations répétées.
Résultat : une finalisation, stock physique 5 → 4, réservation 0 après paiement,
remise consommée une fois, aucune entrée d'appairage pour cette commande.
Les scénarios historiques et les contrôles de fuite dans les logs restent PASS.

## Démarrage et validation manuelle restante

Depuis Magic_city_git :

```powershell
node tools/staging/start.cjs --verify
node tools/staging/start.cjs
```

Ctrl+C arrête les processus créés et conserve les clusters. Utiliser un nouveau
run et un profil de staging neuf pour un parcours propre ; ne pas effacer les
tentatives ou les clusters existants pour contourner une erreur.
Dernier cluster validé : .runtime/run-1791129250212, arrêté et conservé.

1. http://127.0.0.1:5173/catalog : stage-001 M/Blue, une unité, STAGE10.
   Confirmer 9,90 EUR puis procéder ; même onglet sous /checkout/checkout-landing.
2. Vérifier commande et EUR, sans appairage. Cliquer Payer : destination 4101,
   session conservée avant départ, aucun token dans URL ou console.
3. Cliquer Payer en simulation, sans carte réelle. Retour attendu exclusivement
   http://127.0.0.1:5173/checkout/order-confirmation avec IDs publics.
4. Attendre confirmation backend puis PAID et 9,90 EUR. Revenir au Store : panier
   conservé avant PAID vérifié, suppression seulement après lecture autorisée.
5. Reload, double clic, offline et réponse perdue : même ordre/session, reprise
   explicite. Mauvaise session, token révoqué et stockage perdu : blocage ; pas
   d'ordre neuf, pas de repli anonyme. Ne pas injecter de faux état dans le stockage.
6. Vérifier séparément 5174 et l'appairage manuel. Une session déjà créée dans
   l'autre parcours doit bloquer ; reprendre son parcours d'origine.

Exécuter desktop et viewport mobile, puis appareils mobiles via un harness
explicitement autorisé. Loopback n'expose pas le poste au téléphone. Examiner
uniquement les métadonnées réseau, sans capturer tokens/en-têtes/preuves.
Les cookies, extensions, APM/proxy et politiques XSS de production restent hors
validation. Une perte totale des credentials exige une récupération vérifiée
dont le transport email n'est toujours pas configuré.

## Fichiers de phase D

Checkout : src/lib/secureCheckout.ts, src/pages/CheckoutLanding.tsx.
Outillage sous tools/staging/ : backend.cjs, frontend.mjs, scenario.cjs,
common-access-tests.cjs, common-access-production.mjs, common-origin-tests.cjs,
README.md, COMMON_PAYMENT_VALIDATION.md, PHASE_D_RESULTS.json,
VALIDATION_RESULTS.json, STAGING_RESULTS.json, COMMON_ORIGIN_RESULTS.json,
COMMON_BUILD_RESULTS.json, COMMON_ACCESS_PRODUCTION_RESULTS.json.
Les fichiers JSON sont des résultats sans credentials. .runtime reste ignoré.
Aucun fichier métier Store, backend, Admin ou de confirmation Checkout modifié.
Aucune migration ou dépendance ajoutée ; aucun recalcul historique.

Aucun paiement réel, commit, push, merge, changement de branche, déploiement,
production, email réel, activation de frais ou protection obligatoire.
Toutes les données et travaux existants sont conservés. PASS automatisé,
navigateur NON VALIDÉ ; aucun feu vert de production. Attente d'autorisation
avant toute phase suivante.
