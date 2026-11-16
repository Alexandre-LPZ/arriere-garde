# Arrière-Garde — la porte de sécurité avant la mise en ligne

**Avant-Garde** cadre un projet *avant* d'écrire du code. **Arrière-Garde** le vérifie *avant* de le
mettre en ligne. Fait pour les débutants et les vibe-codeurs — et pour l'assistant IA qui les
accompagne, afin qu'il ait un cadre de contrôle au lieu de dire « c'est sécurisé » sans preuve.

## Trois étages
| Étage | Quoi | Coût | Outil |
|---|---|---|---|
| **1. Pré-vol statique** | les cinq fautes du vibe-codeur : secret dans le code/git, clé serveur côté client, table Supabase sans RLS, colonne de droit modifiable par son propriétaire, configuration de déploiement sans en-têtes | gratuit, 5 min, sans réseau | `scripts/preflight.mjs` |
| **2. Revue senior** | checklist niveau senior en 8 domaines (sessions, autorisations, entrées, secrets, dépendances, journaux, RGPD, test manuel Supabase) — chaque ligne OK / À corriger / Non testé | gratuit, 20-40 min | `references/revue-senior.md` |
| **3. Test d'intrusion autorisé** | [Strix](https://github.com/usestrix/strix) (Apache 2.0) sur une cible **possédée et non productive**, après devis et GO humain | centimes à quelques euros de tokens | `scripts/devis-strix.mjs` |

## Règles fondatrices
1. Jamais « sécurisé » sans test qui a échoué à entrer ; toujours la liste de ce qui n'a pas été testé.
2. On ne teste que ce qui nous appartient (ou avec autorisation écrite). Jamais la production.
3. Devis avant dépense ; le GO est humain (jeton `.cockpit_go` du plugin
   [ultracode-cockpit](https://github.com/Alexandre-LPZ/garde-fous) ou `ARRIERE_GARDE_GO=1` posé
   par l'humain) ; l'assistant ne le crée jamais.
4. Chaque constat est expliqué en français simple (`references/pedagogie.md`).

## Installation
- **Compte Claude (chat, Cowork, et Claude Code par la sync)** : importer `arriere-garde/SKILL.md`
  via Customize → Skills (la doctrine + les checklists). Les scripts s'exécutent là où il y a Node.
- **Claude Code, par projet** : copier le dossier `arriere-garde/` dans `.claude/skills/`.
- Étage 3 : Docker en marche, `pip install strix-agent`, `LLM_API_KEY` + `STRIX_LLM` définis par
  l'humain (modèle économique via `LLM_API_BASE`, `STRIX_REASONING_EFFORT=medium`).

## Usage minimal
```bash
node arriere-garde/scripts/preflight.mjs .                          # étage 1
# étage 2 : dérouler references/revue-senior.md avec l'humain
node arriere-garde/scripts/devis-strix.mjs --target http://localhost:3000 --owner "préprod locale du projet X"   # étage 3, devis puis GO
```

## Banc de test (16/11/2026)
- `preflight.mjs` sur un projet volontairement fautif (secret OpenAI dans le code, `.env` commité
  avec `NEXT_PUBLIC_STRIPE_SECRET_KEY`, table `orders` sans RLS, `profiles.is_admin` modifiable par
  son propriétaire, CORS `*`, aucun en-tête) : **5 FAIL · 5 WARN**, tous attendus, chacun avec
  correctif et phrase pédagogique. Sur un projet propre : **0 · 0 · 0**, sans faux positif.
- `devis-strix.mjs` : 5 barrières testées — pas d'attestation → STOP ; domaine public → STOP
  « production » ; local sans GO → devis puis STOP ; préprod déclarée → devis ; GO sans clé → STOP.

## Crédits
Inspiré par le guide communautaire sur Strix et par le retour d'expérience d'un développeur data dont
le premier SaaS a été compromis à cause d'une colonne `is_admin` modifiable sous RLS — « ce n'est pas
la faute de Supabase, c'est la mienne ». Strix est un projet indépendant (UseStrix, Apache 2.0) ;
Arrière-Garde ne le redistribue pas, il l'encadre.

Licence MIT. Fait avec Claude (le Pilote) dans l'équipe Trinity OASIS.
