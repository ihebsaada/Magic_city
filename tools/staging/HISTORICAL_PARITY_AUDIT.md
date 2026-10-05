# Audit historique - 5 octobre 2026

Source Store : bf60c5f ; loader introduit par 2fef884. Source Checkout fonctionnelle coherente : 22dc26a (Supabase) ; reference visuelle italienne : 6b9c8b9. Le fonctionnement des anciens deploiements n'est pas prouve par Git.

A - Restaurer les classes et composants historiques : overlay LoadingScreen, Loader2, navigation 400 ms, cards, collections, Select, Mirror Shop, panier, landing et confirmation.
B - Conserver grants scoped, controle EUR/session, idempotence, reservations, lecture autorisee PAID et signatures webhook.
C - Conserver pagination serveur, cancellation, limites et index.
D - Retirer le pairing manuel du nouveau happy path et les appels seamless inexistants. Ne pas facturer des montants arbitraires du navigateur.
E - Presentation historique avec protections actuelles ; canal postMessage strictement lie a la fenetre, origine, commande et nonces, reutilisant le pont backend.

Historique Checkout : a922470 et 22dc26a contiennent Supabase checkout. La fonction accepte les prix et le total du navigateur, cree orders/order_items distincts du modele Prisma, facture USD et ne reserve aucun stock. 5844190 retire ces fonctions et appelle seamless/checkout ; cd24c7c traduit en italien ; 6b9c8b9 modifie les images ; 2d3146d retire Mirror Shop et securise le Checkout.

Regle utilisateur appliquee : conserver les cinq mockups, prix visibles, actions, routes et panier historiques. Aucune conversion du Mirror Shop en catalogue backend et aucun rapprochement de variante invente.

Blocage : le paiement autonome exige un modele commercial serveur pour ces offres, leurs prix/devise et leur stock. Ce n'est pas une modification de handoff, seul changement backend autorise. Le panier est restaure mais son paiement refuse explicitement sans le vider. Aucun endpoint seamless ni chemin Stripe non protege reintroduit.

Ecarts restants : paiement Mirror autonome bloque ; nouvelle fenetre au lieu de navigation historique ; pagination visible ; nouveautes non exposees par le contrat actuel ; etats d'erreur securises explicites. Parite responsive et micro-interactions non certifiables sans navigateur. Voir le rapport final pour les preuves et limites.
