// Construit dist/cortex.html : page autonome contenant le VRAI moteur (src/*.js) + l'interface.
// Mini-bundler : chaque module est isolé dans une fermeture ; ses imports sont réécrits en lectures du registre.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const order = ['rng', 'linalg', 'model', 'world', 'econ', 'discovery', 'agent', 'policies', 'runner', 'envs'];
const bundle = order.map((m) => {
  let src = readFileSync(new URL(`../src/${m}.js`, import.meta.url), 'utf8');
  src = src.replace(/^import \{([^}]*)\} from '\.\/([\w-]+)\.js';$/gm, (_, names, mod) => `const { ${names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': ')).join(', ')} } = __m['${mod}'];`);
  const exported = new Set();
  src = src.replace(/^export (const|function|let) (\w+)(.*)$/gm, (_, kw, name, rest) => {
    exported.add(name);
    // déclarations multiples sur une ligne : export const A = 1, B = 2;
    if (kw !== 'function' && /^\s*=\s*[^(),=]+,\s*\w+\s*=/.test(rest)) for (const mm of rest.matchAll(/,\s*(\w+)\s*=/g)) exported.add(mm[1]);
    return `${kw} ${name}${rest}`;
  });
  src = src.replace(/^export \{([^}]*)\};?$/gm, (_, names) => { names.split(',').map((n) => n.trim()).filter(Boolean).forEach((n) => exported.add(n)); return ''; });
  return `// ---- src/${m}.js ----\n__m['${m}'] = (() => {\n${src}\nreturn { ${[...exported].join(', ')} };\n})();`;
}).join('\n');
const engine = `const __m = {};\n${bundle}\nfor (const k of Object.keys(__m)) Object.assign(globalThis, __m[k]);`;
const tpl = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const out = tpl.replace('/*__ENGINE__*/', () => engine).replace('/*__APP__*/', () => app);
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/cortex.html', import.meta.url), out);
console.log(`dist/cortex.html — ${(out.length / 1024).toFixed(0)} Ko`);
