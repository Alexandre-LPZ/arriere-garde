#!/usr/bin/env node
// devis-strix.mjs — Arrière-Garde, étage 3 : lance Strix (test d'intrusion AUTORISÉ) sous devis et GO humain.
// Usage : node <skill>/scripts/devis-strix.mjs --target <url|chemin> --owner "<attestation>" [--env preprod]
//         [--mode quick|standard] [--instruction-file <fichier>] [--estimate]
// Refus : cible qui ressemble à une production, attestation absente, GO absent.
// GO humain = .cockpit_go (plugin ultracode-cockpit) ou ARRIERE_GARDE_GO=1 posé par l'humain. L'assistant ne le crée jamais.
import { existsSync, statSync, mkdirSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const a = process.argv.slice(2);
const opt = n => { const i = a.indexOf('--' + n); return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : (i >= 0 ? true : undefined); };
const target = opt('target'); const owner = opt('owner'); const env = opt('env'); const mode = opt('mode') || 'quick';
const instr = opt('instruction-file'); const estimate = !!opt('estimate');
const stop = (msg, code) => { console.log('\nSTOP — ' + msg); process.exit(code); };

if (!target || target === true) stop('--target manquant (URL locale/préprod ou chemin du projet).', 64);
if (!owner || owner === true || String(owner).length < 8) stop('--owner manquant : attestation écrite que la cible vous appartient (ou autorisation écrite). Sans elle, rien ne tourne.', 65);

// cible : locale / chemin / préprod déclarée ; tout domaine public sans --env preprod est traité comme production
const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.\d|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(target);
const isPath = !/^https?:\/\//i.test(target) && existsSync(target);
const isUrl = /^https?:\/\//i.test(target);
if (isUrl && !isLocal && env !== 'preprod') stop(`la cible ${target} est un domaine public : traitée comme PRODUCTION. Arrière-Garde ne teste jamais une production. Pointer une préproduction jetable et le dire explicitement avec --env preprod.`, 66);
if (!isUrl && !isPath) stop(`cible introuvable : ${target}`, 67);

const model = process.env.STRIX_LLM || '(STRIX_LLM non défini)';
const effort = process.env.STRIX_REASONING_EFFORT || 'medium (par défaut Arrière-Garde)';
const cost = mode === 'quick' ? 'quelques centimes à ~1 € avec un modèle économique ; 1-5 € avec un modèle premium' : '0,5-3 € avec un modèle économique ; 5-20 € avec un modèle premium';
console.log(['DEVIS Arrière-Garde — étage 3 (Strix)',
  `  cible        : ${target}  [${isPath ? 'dépôt local' : isLocal ? 'URL locale' : 'préprod déclarée'}]`,
  `  attestation  : ${owner}`,
  `  mode         : ${mode}  (quick = recon + essais ciblés ; standard = complet)`,
  `  modèle       : ${model}  · effort : ${effort}`,
  `  réseau       : OUI — les agents appellent la cible ET le fournisseur de modèle (votre code lui est envoyé)`,
  `  durée        : ${mode === 'quick' ? '5-15 min' : '15-60 min'}  · coût attendu : ${cost}`,
  `  écrit        : .arriere-garde/strix-<date>.log, rapport Strix dans son dossier de sortie`,
  `  pré-requis   : Docker en marche ; LLM_API_KEY défini ; étage 1 et 2 faits`].join('\n'));
if (estimate) process.exit(0);

function goPresent() {
  if (process.env.ARRIERE_GARDE_GO === '1') return 'ARRIERE_GARDE_GO=1 (terminal humain)';
  const f = resolve(process.cwd(), '.cockpit_go');
  if (existsSync(f) && (Date.now() - statSync(f).mtimeMs) / 60000 <= 60) return '.cockpit_go (plugin)';
  return null;
}
const go = goPresent();
if (!go) { console.log('  GO           : ABSENT'); stop('devis affiché, GO humain absent. Montrer ce devis à l\'humain ; il pose le jeton (plugin) ou ARRIERE_GARDE_GO=1 dans SON terminal. L\'assistant ne le fait pas.', 3); }
console.log(`  GO           : ${go}`);
if (!process.env.LLM_API_KEY) stop('LLM_API_KEY absent : Strix n\'a pas de modèle. L\'humain le définit dans son terminal.', 68);
const dk = spawnSync('docker', ['info'], { stdio: 'ignore', shell: process.platform === 'win32' });
if (dk.status !== 0) stop('Docker ne répond pas : démarrer Docker Desktop puis relancer.', 69);

mkdirSync('.arriere-garde', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const args = ['--non-interactive', '--scan-mode', mode, '--target', target];
if (instr && instr !== true) args.push('--instruction-file', instr);
appendFileSync('.arriere-garde/journal.md', `- ${new Date().toISOString()} | ÉTAGE 3 | GO=${go} | strix ${args.join(' ')} | owner="${owner}"\n`);
console.log(`\nstrix ${args.join(' ')}\n`);
const r = spawnSync('strix', args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, STRIX_REASONING_EFFORT: process.env.STRIX_REASONING_EFFORT || 'medium' } });
appendFileSync('.arriere-garde/journal.md', `  → fin ${new Date().toISOString()} code=${r.status}  (code non nul = constats à lire, pas un échec du script)\n`);
console.log(r.status === null ? '\nStrix introuvable : pip install strix-agent (ou l\'installateur officiel, lu avant exécution).' : `\nStrix terminé (code ${r.status}). Reporter chaque constat dans .arriere-garde/rapport.md avec sa preuve, corriger, puis RE-TESTER : un correctif non re-testé reste « À corriger ».`);
process.exit(r.status ?? 70);
