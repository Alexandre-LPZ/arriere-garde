# Revue senior — étage 2 (checklist, OK / À corriger / Non testé)

Dérouler avec l'humain. On n'écrit OK qu'après avoir regardé. Tout « Non testé » va dans le rapport.

## A. Identité et sessions
- Mots de passe : jamais stockés en clair ; hachage géré par le fournisseur d'auth (Supabase Auth, Better Auth, Clerk…), pas maison.
- Sessions : expiration ; déconnexion qui invalide réellement ; cookies `HttpOnly`, `Secure`, `SameSite`.
- Réinitialisation de mot de passe : lien à usage unique, expirant, qui ne révèle pas si l'e-mail existe.
- Limitation de débit sur connexion / inscription / réinitialisation (sinon force brute et spam).
- 2FA proposée pour les comptes administrateurs.

## B. Autorisations (la faute la plus fréquente après les secrets)
- **Test de l'identifiant voisin** : connecté en tant qu'utilisateur A, demander l'objet de B en changeant l'identifiant dans l'URL ou l'appel API. Doit échouer. À faire sur CHAQUE ressource (commande, document, profil, facture).
- Rôles vérifiés **côté serveur** à chaque requête, jamais seulement en masquant un bouton.
- Supabase : RLS activée sur chaque table ; policies `select / insert / update / delete` distinctes ; `WITH CHECK` sur les écritures ; colonnes de droit ou de solde non modifiables par leur propriétaire.
- Actions administrateur derrière un rôle serveur, pas derrière une page « cachée ».

## C. Entrées et sorties
- Toute entrée validée côté serveur (schéma : zod, valibot…), pas seulement dans le formulaire.
- Requêtes paramétrées / ORM ; jamais de concaténation de texte utilisateur dans du SQL.
- Sortie HTML échappée par le framework ; `dangerouslySetInnerHTML` / `v-html` justifiés un par un.
- Téléversement de fichiers : type et taille contrôlés, stockage hors du code, nom régénéré, pas d'exécution.
- Redirections : uniquement vers des chemins internes ou une liste blanche.

## D. Secrets et configuration
- Aucun secret dans le code, le dépôt, l'historique, les logs, les messages d'erreur ; `.env` ignoré.
- Variables publiques (`NEXT_PUBLIC_`, `VITE_`) : seulement ce qui peut être lu par tout le monde.
- Clés serveur (`service_role`, Stripe secret) : uniquement dans des routes serveur.
- Erreurs : pages génériques en production ; pas de trace de pile ni de requête SQL affichée.
- En-têtes : HSTS, CSP, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy.
- CORS : origines listées ; jamais `*` sur une API authentifiée.

## E. Dépendances et chaîne de production
- `npm audit` / `pnpm audit` sans vulnérabilité critique ouverte ; versions figées (lockfile commité).
- Pas de paquet inconnu ajouté « pour aller vite » sans lecture de ce qu'il fait.
- Scripts `curl | bash` lus avant exécution.
- Déploiement : branche de production protégée ; variables d'environnement scopées (preview ≠ prod).

## F. Journalisation, limites, sauvegardes
- Journaux des connexions, des actions admin, des paiements — sans données sensibles dedans.
- Limites de débit sur les points coûteux (envoi d'e-mail, appels IA, export).
- Sauvegarde de la base testée par une restauration réelle au moins une fois.

## G. Données personnelles (RGPD)
- Minimisation : on ne collecte que ce qui sert ; durée de conservation définie.
- Droit d'accès et d'effacement : un chemin existe (même manuel, documenté).
- Mentions : qui est responsable, quelles données, pourquoi, combien de temps ; sous-traitants listés (hébergeur, modèle IA utilisé si des données lui sont envoyées).
- Données envoyées à un modèle IA : l'utilisateur le sait ; les secrets et données de tiers n'y vont pas.

## H. Le test manuel qui vaut tout (Supabase)
1. Récupérer la clé publique (`anon`) et l'URL du projet depuis le site déployé (elles sont visibles, c'est normal).
2. Depuis un terminal, sans session : `curl "https://<projet>.supabase.co/rest/v1/<table>?select=*" -H "apikey: <anon>" -H "Authorization: Bearer <anon>"`.
3. Si des lignes reviennent : la table est ouverte. Si `[]` ou une erreur de permission : la RLS fait son travail.
4. Refaire pour chaque table listée par l'étage 1. Noter le résultat table par table dans le rapport.
