// Démonstration en terminal : une année de CORTEX, journal des moments clés.
import { runEpisode } from '../src/runner.js';
const seed = +(process.argv[2] || 1);
const t0 = Date.now();
const full = runEpisode({ seed });
const oracle = runEpisode({ seed, policy: 'oracle' });
const habit = runEpisode({ seed, policy: 'habit' });
console.log(`Graine ${seed} — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log('Vérité cachée :'); for (const e of full.world.scenario.events) console.log(`  jour ${e.start}${e.end ? '–' + e.end : ''} : ${e.label}`);
console.log('Croyances de CORTEX :'); for (const b of full.agent.beliefs) console.log(`  [admise j${b.acceptedAt}] ${b.narrative}`);
for (const b of full.agent.retracted) console.log(`  [rétractée j${b.retractedAt}] ${b.type} j${b.tau}`);
console.log('Règles apprises :'); for (const r of full.agent.rules.list) console.log('  ' + r.text);
console.log('Compétence commande :', full.agent.skills.order.notes.map((n) => n.text).join(' | ') || '(inchangée)');
console.log(`κ final ${full.agent.kappa.toFixed(2)} ; revues : ${full.reviews} (approuvées ${full.approvals})`);
console.log(`Profit annuel — CORTEX ${full.profit.toFixed(0)} € | Oracle ${oracle.profit.toFixed(0)} € | Habitude ${habit.profit.toFixed(0)} €`);
