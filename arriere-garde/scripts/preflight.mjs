#!/usr/bin/env node
// preflight.mjs — Arrière-Garde, étage 1 : pré-vol statique, gratuit, sans réseau.
// Usage : node <skill>/scripts/preflight.mjs [racine du projet]
// Lit le dépôt (jamais la base réelle), écrit .arriere-garde/preflight.json et un résumé.
// Sortie : code 2 si FAIL, 1 si seulement WARN, 0 si rien.
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.argv[2] ? process.argv[2] : '.';
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.vercel', '.turbo', 'coverage', '.arriere-garde', '.taste-skill']);
const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.astro', '.json', '.env', '.sql', '.toml', '.yaml', '.yml', '.md', '.html', '.css', '.txt', '.sh', '.ps1', '.py']);
const findings = [];
const add = (level, check, file, line, msg, fix, why) => findings.push({ level, check, file, line, msg, fix, why });

// ---- 1. secrets : motifs connus (préfixes publics des fournisseurs) ----
const SECRET_PATTERNS = [
  ['OpenAI', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['Anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['Stripe secret', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['JWT (clé Supabase ?)', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['Clé privée', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['URL avec mot de passe', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]{4,}@[^\s/]+/i],
];
const SERVER_ONLY_NAMES = /\b(SERVICE_ROLE|SUPABASE_SERVICE[A-Z_]*|STRIPE_SECRET[A-Z_]*|DATABASE_URL|DB_PASSWORD|PRIVATE_KEY|SECRET_KEY|JWT_SECRET|API_SECRET)\b/;
const PUBLIC_PREFIX = /\b(NEXT_PUBLIC_|VITE_|REACT_APP_|NUXT_PUBLIC_|PUBLIC_|EXPO_PUBLIC_)([A-Z0-9_]+)/g;
const SENSITIVE_WORD = /(SECRET|SERVICE|PRIVATE|PASSWORD|TOKEN|DATABASE_URL)/;
const CLIENT_DIRS = /(^|\/)(src|app|pages|components|public|client|frontend|www|static)(\/|$)/;

// ---- walk ----
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* walk(p);
    else if (st.size < 2_000_000) yield p;
  }
}
const files = [...walk(root)];
const rel = p => relative(root, p).split('\\').join('/');

const sqlTexts = [];
const envFiles = [];
for (const f of files) {
  const base = basename(f); const ext = extname(f).toLowerCase();
  const isEnv = base.startsWith('.env');
  if (!TEXT.has(ext) && !isEnv) continue;
  let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  const r = rel(f);
  if (isEnv) envFiles.push(r);
  if (ext === '.sql') sqlTexts.push([r, txt]);
  const lines = txt.split('\n');
  lines.forEach((ln, i) => {
    const realEnv = isEnv && !base.includes('example') && !base.includes('sample');
    if (realEnv) { // .env réel : on ne lit que les NOMS (un nom public sensible est une faute même si le fichier n'est pas commité)
      let m2; PUBLIC_PREFIX.lastIndex = 0;
      while ((m2 = PUBLIC_PREFIX.exec(ln))) if (SENSITIVE_WORD.test(m2[2]) && !/ANON|PUBLISHABLE/.test(m2[2]))
        add('FAIL', 'public-env-sensitive', r, i + 1, `Variable publique au nom sensible : ${m2[1]}${m2[2]}`, 'Retirer le préfixe public ; cette valeur ne doit exister que côté serveur', 'Un préfixe public dit au bundler d\'embarquer la valeur dans le JavaScript du navigateur : la clé secrète part chez chaque visiteur.');
      return;
    }
    for (const [name, re] of SECRET_PATTERNS) {
      if (re.test(ln) && !/example|placeholder|xxx|your[_-]?key|<.*>/i.test(ln)) {
        add('FAIL', 'secret-in-code', r, i + 1, `Motif « ${name} » dans le code`, 'Révoquer et régénérer la clé chez le fournisseur, la déplacer dans une variable d\'environnement serveur, puis purger l\'historique git', 'Une clé écrite dans le code est copiée dans chaque clone et dans l\'historique : la supprimer ne suffit pas, il faut la révoquer.');
      }
    }
    let m; PUBLIC_PREFIX.lastIndex = 0;
    while ((m = PUBLIC_PREFIX.exec(ln))) {
      if (SENSITIVE_WORD.test(m[2]) && !/ANON|PUBLISHABLE/.test(m[2]))
        add('FAIL', 'public-env-sensitive', r, i + 1, `Variable publique au nom sensible : ${m[1]}${m[2]}`, 'Retirer le préfixe public et ne l\'utiliser que côté serveur (route API, server action)', 'Tout ce qui porte un préfixe public est embarqué dans le JavaScript envoyé au navigateur : n\'importe qui peut le lire.');
    }
    if (CLIENT_DIRS.test(r) && SERVER_ONLY_NAMES.test(ln) && !/process\.env\.NEXT_PUBLIC|import\.meta\.env\.VITE/.test(ln) && !r.endsWith('.md'))
      add('WARN', 'server-name-in-client-dir', r, i + 1, `Nom de secret serveur dans un dossier client : ${ln.match(SERVER_ONLY_NAMES)[0]}`, 'Vérifier que ce fichier n\'est jamais servi au navigateur (server-only), sinon déplacer la logique côté serveur', 'La clé service_role de Supabase ou la clé secrète Stripe contournent toutes les règles : elles ne doivent jamais quitter le serveur.');
    if (/Access-Control-Allow-Origin['"]?\s*[:=]\s*['"]\*/.test(ln) || /cors\(\s*\)/.test(ln) || /origin:\s*['"]\*['"]/.test(ln))
      add('WARN', 'cors-wildcard', r, i + 1, 'CORS ouvert à toutes les origines', 'Lister explicitement les origines autorisées', 'Avec CORS *, tout site tiers peut appeler votre API depuis le navigateur d\'un visiteur.');
  });
}

// ---- 2. git : .env suivis, .gitignore ----
let gitTracked = [];
try { gitTracked = execSync('git ls-files', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').filter(Boolean); } catch { }
for (const t of gitTracked) {
  const b = basename(t);
  if (b.startsWith('.env') && !/example|sample|template/.test(b))
    add('FAIL', 'env-tracked-by-git', t, 0, 'Fichier .env suivi par git', 'git rm --cached ' + t + ' ; l\'ajouter au .gitignore ; révoquer toutes les clés qu\'il contient ; purger l\'historique', 'Un .env commité est dans l\'historique de chaque clone et de GitHub : ses clés sont à considérer comme publiques.');
}
if (gitTracked.length) {
  const gi = existsSync(join(root, '.gitignore')) ? readFileSync(join(root, '.gitignore'), 'utf8') : '';
  if (!/^\s*\.env/m.test(gi)) add('WARN', 'gitignore-env', '.gitignore', 0, '.env n\'est pas ignoré par git', 'Ajouter « .env*  » et « !.env.example » au .gitignore', 'Sans cette ligne, le prochain « git add . » emportera vos secrets.');
}
if (!gitTracked.length) add('INFO', 'no-git', '.', 0, 'Pas de dépôt git détecté : les contrôles d\'historique sont sautés', 'Initialiser git avant la mise en ligne', 'Sans historique, on ne peut pas prouver qu\'aucun secret n\'a jamais été commité.');

// ---- 3-4. Supabase : tables sans RLS, colonnes sensibles modifiables ----
const SENSITIVE_COLS = /\b(is_admin|isadmin|admin|role|roles|plan|tier|credits|balance|is_verified|verified|is_premium|subscription_status|status)\b/i;
const tables = {}; // name -> {file, rls, policies:[], cols:[]}
for (const [r, txt] of sqlTexts) {
  const low = txt.toLowerCase();
  let m; const ct = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\);/gi;
  while ((m = ct.exec(txt))) {
    const name = m[1].toLowerCase();
    const cols = m[2].split(',').map(c => c.trim().split(/\s+/)[0].replace(/"/g, '').toLowerCase()).filter(Boolean);
    tables[name] = tables[name] || { file: r, rls: false, policies: [], cols: [] };
    tables[name].cols.push(...cols);
  }
  const rls = /alter\s+table\s+(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s+enable\s+row\s+level\s+security/gi;
  while ((m = rls.exec(txt))) { const n = m[1].toLowerCase(); tables[n] = tables[n] || { file: r, rls: false, policies: [], cols: [] }; tables[n].rls = true; }
  const pol = /create\s+policy\s+"?[^"\n]*"?\s+on\s+(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?([\s\S]*?);/gi;
  while ((m = pol.exec(txt))) { const n = m[1].toLowerCase(); tables[n] = tables[n] || { file: r, rls: false, policies: [], cols: [] }; tables[n].policies.push(m[2].toLowerCase()); }
}
for (const [name, t] of Object.entries(tables)) {
  if (!t.rls) add('FAIL', 'rls-missing', t.file, 0, `Table « ${name} » : RLS non activée dans les migrations`, `alter table public.${name} enable row level security; puis écrire les policies (select/insert/update/delete)`, 'Sans RLS, la clé publique embarquée dans le site lit et écrit toute la table, pour n\'importe qui.');
  else if (!t.policies.length) add('WARN', 'rls-no-policy', t.file, 0, `Table « ${name} » : RLS activée mais aucune policy trouvée (table inaccessible, ou policies créées ailleurs)`, 'Vérifier dans le tableau de bord Supabase (Authentication → Policies)', 'RLS sans policy bloque tout : c\'est sûr mais souvent le signe que les règles sont définies à la main, hors du code.');
  const sens = t.cols.filter(c => SENSITIVE_COLS.test(c));
  const selfUpdate = t.policies.some(p => /for\s+(update|all)/.test(p) && /auth\.uid\(\)/.test(p) && !/with\s+check[\s\S]*(is_admin|role)\s*=/.test(p));
  if (sens.length && selfUpdate)
    add('FAIL', 'sensitive-column-self-update', t.file, 0, `Table « ${name} » : colonnes sensibles (${sens.join(', ')}) ET une policy d'update « par le propriétaire »`, 'Sortir ces colonnes dans une table réservée au serveur, ou interdire leur modification (trigger / colonne non exposée / policy WITH CHECK qui fige la valeur)', 'La règle « chacun modifie sa ligne » laisse l\'utilisateur modifier TOUTE sa ligne, y compris is_admin : il peut se nommer administrateur avec la clé publique.');
  else if (sens.length)
    add('INFO', 'sensitive-column', t.file, 0, `Table « ${name} » : colonnes sensibles (${sens.join(', ')}) — vérifier qu\'aucune policy ne permet à l\'utilisateur de les modifier`, 'Voir references/supabase-vercel.md', 'Une colonne de droit ou de solde ne doit être modifiable que par le serveur.');
}
if (!Object.keys(tables).length && files.some(f => /supabase/i.test(rel(f))))
  add('INFO', 'supabase-no-migrations', '.', 0, 'Projet Supabase sans migrations SQL dans le dépôt : impossible de vérifier les RLS depuis le code', 'Exporter le schéma (supabase db dump) ou vérifier chaque table à la main dans Authentication → Policies', 'Ce qui n\'est pas dans le code ne peut pas être relu ni re-testé.');

// ---- 5. configuration de déploiement ----
const cfgs = files.filter(f => /(^|\/)(vercel\.json|next\.config\.(js|mjs|ts)|netlify\.toml|nuxt\.config\.(js|ts)|astro\.config\.(mjs|js|ts))$/.test(rel(f)));
if (cfgs.length) {
  const all = cfgs.map(f => readFileSync(f, 'utf8')).join('\n');
  const has = re => re.test(all);
  const missing = [];
  if (!has(/Strict-Transport-Security/i)) missing.push('HSTS');
  if (!has(/Content-Security-Policy/i)) missing.push('CSP');
  if (!has(/X-Frame-Options|frame-ancestors/i)) missing.push('anti-clickjacking (X-Frame-Options / frame-ancestors)');
  if (!has(/X-Content-Type-Options/i)) missing.push('X-Content-Type-Options');
  if (!has(/Referrer-Policy/i)) missing.push('Referrer-Policy');
  if (missing.length) add('WARN', 'security-headers', cfgs.map(rel).join(', '), 0, `En-têtes de sécurité absents : ${missing.join(', ')}`, 'Les déclarer dans headers() de next.config / vercel.json (modèle dans references/supabase-vercel.md)', 'Les en-têtes sont la ceinture de sécurité du navigateur : sans eux, un script injecté ou une page encadrée passe.');
} else add('INFO', 'no-deploy-config', '.', 0, 'Aucune configuration de déploiement trouvée (vercel.json / next.config / netlify.toml)', 'Vérifier les en-têtes de sécurité à la main après déploiement (securityheaders.com)', 'La configuration par défaut d\'un hébergeur n\'envoie pas ces en-têtes.');

// ---- rapport ----
mkdirSync(join(root, '.arriere-garde'), { recursive: true });
const order = { FAIL: 0, WARN: 1, INFO: 2 };
findings.sort((a, b) => order[a.level] - order[b.level] || a.check.localeCompare(b.check));
const counts = { FAIL: 0, WARN: 0, INFO: 0 }; findings.forEach(f => counts[f.level]++);
const out = { date: new Date().toISOString(), root: root, files: files.length, tables: Object.keys(tables), counts, findings };
writeFileSync(join(root, '.arriere-garde', 'preflight.json'), JSON.stringify(out, null, 2));
console.log(`ARRIÈRE-GARDE — pré-vol statique sur ${files.length} fichiers, ${Object.keys(tables).length} table(s) SQL`);
for (const f of findings) {
  console.log(`\n${f.level}  ${f.check}  ${f.file}${f.line ? ':' + f.line : ''}\n   ${f.msg}\n   → ${f.fix}\n   ? ${f.why}`);
}
console.log(`\nBILAN : ${counts.FAIL} FAIL · ${counts.WARN} WARN · ${counts.INFO} INFO  (détail : .arriere-garde/preflight.json)`);
if (Object.keys(tables).length) console.log(`Tables à cocher dans le tableau de bord Supabase : ${Object.keys(tables).join(', ')}`);
console.log(counts.FAIL ? 'PRÉ-VOL : BLOQUÉ — corriger les FAIL avant l\'étage 2.' : counts.WARN ? 'PRÉ-VOL : OUVERT — WARN à traiter ou à justifier dans le rapport.' : 'PRÉ-VOL : rien trouvé — ce n\'est pas une preuve de sécurité, c\'est l\'absence des cinq fautes courantes.');
process.exit(counts.FAIL ? 2 : counts.WARN ? 1 : 0);
