# Supabase & Vercel — les pièges spécifiques et leurs correctifs

Source du constat : retour d'expérience d'un développeur data (10 ans) dont le premier SaaS a été
compromis — « ce n'est pas la faute de Supabase, c'est la mienne ». Les correctifs sont les nôtres.

## 1. Le modèle mental à avoir
Supabase expose une API REST automatique pour chaque table. La clé `anon` est **publique par
conception** : elle est dans le JavaScript du site. Ce n'est pas elle qui protège. **Ce qui protège,
ce sont les policies RLS**, table par table, opération par opération. Une table sans RLS = une table
lisible et modifiable par quiconque lit la clé dans le code source du site.

## 2. Les quatre pièges
| Piège | Symptôme | Correctif |
|---|---|---|
| **RLS oubliée** sur une table | `curl` avec la clé anon renvoie des lignes | `alter table public.t enable row level security;` + policies explicites par opération |
| **RLS « chacun sa ligne » sur une table qui contient des droits** (`is_admin`, `role`, `plan`, `credits`) | l'utilisateur modifie sa ligne et se nomme admin | sortir ces colonnes dans une table à part (`user_roles`, `user_credits`) **sans policy d'écriture pour l'utilisateur** ; ou trigger `before update` qui remet l'ancienne valeur si l'appelant n'est pas le serveur ; ou policy `with check (is_admin = (select is_admin from profiles where id = auth.uid()))` qui fige la colonne |
| **`service_role` côté client** | la clé qui contourne toute RLS se retrouve dans un composant ou une variable `NEXT_PUBLIC_` | ne l'utiliser que dans des routes serveur / server actions ; la faire tourner si elle a fuité |
| **Policy écrite pour `select` seulement** | lecture protégée, mais `insert`/`update`/`delete` ouverts | une policy par opération ; `with check` sur toute écriture |

## 3. Modèle de migration sûre
```sql
create table public.profiles (id uuid primary key references auth.users, display_name text);
alter table public.profiles enable row level security;
create policy "read own"   on public.profiles for select using (auth.uid() = id);
create policy "update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- les droits vivent AILLEURS, sans policy d'écriture côté client
create table public.user_roles (user_id uuid primary key references auth.users, role text not null default 'user');
alter table public.user_roles enable row level security;
create policy "read own role" on public.user_roles for select using (auth.uid() = user_id);
-- aucune policy insert/update/delete : seul le serveur (service_role) écrit ici
```

## 4. Vercel / Next : configuration minimale
- Variables d'environnement : scoper **Production / Preview / Development** séparément ; une clé de
  prod ne doit pas exister en Preview (les URL de preview sont publiques).
- En-têtes dans `next.config.js` :
```js
async headers() { return [{ source: '/(.*)', headers: [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; script-src 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' } ] }]; }
```
(La CSP se durcit progressivement : commencer en `Content-Security-Policy-Report-Only`, lire les
rapports, puis basculer.)
- Routes API : vérifier la session **dans la route**, pas seulement dans le middleware.
- Logs Vercel : ne jamais y écrire de jeton, d'e-mail complet ni de corps de requête sensible.

## 5. Si une clé a fuité
Révoquer → régénérer → redéployer → purger l'historique git (`git filter-repo`) → considérer que
tout ce que la clé protégeait a pu être lu, et agir en conséquence (informer si données personnelles).
