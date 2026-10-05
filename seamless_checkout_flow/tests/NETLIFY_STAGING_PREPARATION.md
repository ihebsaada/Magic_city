# Checkout staging ? panier h?rit? retir?

5 octobre 2026. Worktree Magic_city_checkout_security, base 6b9c8b9.
Branche pr?par?e : staging/checkout. Aucun commit, push ou d?ploiement.

/cart ne lance plus de paiement : location.replace vers VITE_STORE_ORIGIN + /cart.
Origine configur?e au build uniquement, HTTPS ou loopback HTTP ; credentials,
chemin, query, fragment, protocole arbitraire et configuration absente refus?s.
Aucune URL production cod?e en dur ni origine lue depuis le navigateur.
Home et Navigation renvoient au Store, sans deuxi?me catalogue ou panier.
lib/cart.ts supprim? car sans consommateur ; stockages existants non effac?s.
Confirmation ne vide plus le panier Checkout h?rit?. Store conserve sa propre
v?rification backend avant suppression du panier. Guest/handoff/pay/confirm inchang?s.

| Contr?le | R?sultat |
| --- | --- |
| TypeScript application/configuration/tests | PASS |
| Build production par d?faut et configuration staging | PASS |
| Tests historiques guest/handoff/payment | PASS ? 51 |
| Tests origine/redirection/panier retir? | PASS ? 6 |
| Total | PASS ? 57, aucun ?chec ou test ignor? |
| Lint TS/TSX concern?s et diff check | PASS |
| Appel runtime seamless/checkout, USD, ancien panier | Aucun dans src |
| Backend 40793c4 | Compatible par analyse des contrats ; aucun appel r?el |
| Navigateur / Netlify r?el | NON VALID? |

Configuration publique : VITE_PRIMARY_API_URL=<origine backend staging>/api,
VITE_STORE_ORIGIN=<origine Store staging>, VITE_ROUTER_BASENAME=/.
Aucun secret dans VITE. Les exemples .invalid sont uniquement des placeholders.
Appairage manuel deux origines conserv?. Ne pas activer common/local simulator
sur Netlify. Build npm run build, base seamless_checkout_flow, publication dist.
SPA public/_redirects existant conserv?. JSON utile du lockfile conserv?.

Validation manuelle restante : charger /cart directement et recharger, v?rifier
la destination exacte Store/cart sans fetch de paiement ; configuration absente
ou invalide : blocage explicite. Tester Home et Navigation, puis commande autoris?e,
appairage, reload, paiement et confirmation sans remplacement ordre/session/token.
Contr?ler les onglets A/B et les traces sans copier les secrets.
Aucune connexion DB, migration, donn?e ou modification Store/Backend/Admin.
Index Store v?rifi? identique : 65 fichiers, SHA256 du diff binaire
515c32437bbe9f9b1caef17d42f0bbfbbff685c5706980cf21a39219374d9657.

READY_FOR_CHECKOUT_COMMIT = YES
READY_FOR_NETLIFY = NO ? domaines/configuration r?els et parcours navigateur ? valider.
