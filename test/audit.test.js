// Audit : le cerveau générique ne doit contenir AUCUNE connaissance d'un métier ou d'une activité.
// Toute capacité doit venir de la déclaration du corps et des données.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// mots entiers (pluriel accepté) et préfixes
const WORDS = ['maintenance', 'usure', 'cadence', 'rebut', 'pièce', 'piece', 'prix', 'price', 'marketing', 'pub', 'menu', 'serveur', 'staff', 'couvert', 'ticket', 'meteo', 'météo', 'inscription', 'résiliation', 'essai', 'restaurant', 'usine', 'commande', 'order', 'sales', 'vente', 'stock', 'farine', 'hotel', 'hôtel', 'ferme', 'récolte', 'engrais', 'irrigation'];
const PREFIXES = ['abonn', 'boulang', 'heuressup'];
const dir = new URL('../src/core/', import.meta.url);

test('le cerveau (src/core) ne nomme aucun levier, aucune mesure, aucune activité', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    // on ne regarde que le code, pas les commentaires
    const code = readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
    for (const w of WORDS) assert.ok(!new RegExp(`(^|[^a-zà-ÿ])${w}[sx]?([^a-zà-ÿ]|$)`, 'i').test(code), `${f} contient « ${w} »`);
    for (const w of PREFIXES) assert.ok(!new RegExp(`(^|[^a-zà-ÿ])${w}`, 'i').test(code), `${f} contient « ${w}… »`);
  }
});
