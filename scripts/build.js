// Construit dist/cortex.html : page autonome contenant le VRAI moteur (src/*.js) + l'interface.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const order = ['rng', 'linalg', 'model', 'world', 'econ', 'agent', 'policies', 'runner'];
const engine = order.map((m) => {
  const src = readFileSync(new URL(`../src/${m}.js`, import.meta.url), 'utf8');
  return `// ---- src/${m}.js ----\n` + src.replace(/^import .*;$/gm, '').replace(/^export (?=(const|function|let))/gm, '');
}).join('\n');
const tpl = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const out = tpl.replace('/*__ENGINE__*/', () => engine).replace('/*__APP__*/', () => app);
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/cortex.html', import.meta.url), out);
console.log(`dist/cortex.html — ${(out.length / 1024).toFixed(0)} Ko`);
