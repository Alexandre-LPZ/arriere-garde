# Pédagogie — expliquer sans jargon

Le débutant doit repartir en comprenant. Une phrase par notion, en français simple, puis l'image.

- **Clé publique / clé serveur** : la clé publique est la *carte de visite* du site, tout le monde
  peut la lire. La clé serveur est la *clé du coffre* : si elle sort du serveur, le coffre est ouvert.
- **RLS (Row Level Security)** : c'est le *vigile à l'entrée de chaque table* qui demande « qui
  es-tu ? » avant de montrer une ligne. Sans vigile, la table est un hall de gare.
- **Policy** : la *consigne donnée au vigile* : « montre à chacun ses lignes, pas celles des autres ».
  Une consigne par geste : lire, ajouter, modifier, supprimer.
- **Colonne de droit** (`is_admin`, `credits`) : un *badge*. On ne laisse personne imprimer son
  propre badge : les badges se fabriquent au bureau (le serveur), jamais à l'accueil (le navigateur).
- **Secret commité** : une *carte bancaire photocopiée dans un journal*. Même si on retire la page
  demain, des gens l'ont déjà vue. On fait opposition (révoquer), on en commande une autre.
- **Variable `NEXT_PUBLIC_`** : *écrit au feutre sur la vitrine*. Si ça ne doit pas être lu de la
  rue, ça ne va pas sur la vitrine.
- **En-têtes de sécurité** : la *ceinture et les airbags* du navigateur de vos visiteurs. Gratuits,
  invisibles, et on ne pense à eux qu'après l'accident.
- **Identifiant voisin (IDOR)** : changer le numéro dans l'URL pour voir *le dossier du voisin*. Si ça
  marche, n'importe qui peut lire tous les dossiers en comptant jusqu'à mille.
- **Test d'intrusion autorisé** : on engage *quelqu'un pour essayer d'ouvrir nos propres portes*
  avant qu'un inconnu ne le fasse. On n'essaie jamais les portes des autres : c'est un délit.
- **« Non testé »** : ce n'est pas un aveu, c'est une *information* — la plus honnête du rapport.
  Un site « sécurisé » sans preuve est un site dont on ne sait rien.

## Les trois phrases à dire au débutant
1. « Ce n'est pas grave d'avoir fait cette erreur ; tout le monde la fait au premier projet. »
2. « Voilà pourquoi c'est dangereux, en une image. »
3. « Voilà le correctif, et voilà comment on vérifie qu'il tient. »
