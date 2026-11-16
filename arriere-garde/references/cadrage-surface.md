# Cadrage de la surface — avant l'étage 3

Cinq minutes avec l'humain, une question à la fois (widgets de choix si disponibles). Le résultat sert
d'`--instruction-file` à Strix et de colonne « périmètre » au rapport.

1. **Nature** : site vitrine / SaaS / e-commerce / API / app mobile / outil interne.
2. **Pile** : framework, base (Supabase ? Postgres ? autre), hébergeur, fournisseur d'auth, paiement.
3. **Comptes et rôles** : y a-t-il des utilisateurs ? des administrateurs ? des organisations/équipes ?
4. **Données** : lesquelles sont personnelles ou sensibles ? où sont-elles ? qui y accède ?
5. **Exposé vs privé** : quelles pages/API sont publiques, lesquelles exigent une session ?
6. **Tiers et secrets** : quelles intégrations (IA, paiement, e-mail, stockage) ; où vivent leurs clés ?
7. **Le pire** : qu'est-ce qui ferait le plus mal — fuite de données, prise de contrôle d'un compte,
   fraude, effacement ? (C'est là que le scan concentre son effort.)
8. **Cible du test** : local ou préprod jetable, avec une base de test — jamais la prod. Attestation de
   propriété écrite (la phrase passée à `--owner`).

Écrire la synthèse en 10 lignes : périmètre autorisé, hors périmètre, priorités (du « pire » vers le reste).
