// Corps écrits après le gel du cerveau (protocole n° 2).
import { usineBody } from './usine.js';
import { abonnementBody } from './abonnement.js';
export const BODIES = {
  usine: usineBody, abonnement: abonnementBody,
  // variantes de contrôle de l'usine (développement v4)
  'usine-placebo': (seed) => usineBody(seed, undefined, 'placebo'),
  'usine-cadence': (seed) => usineBody(seed, undefined, 'cadence'),
  'usine-rupture': (seed) => usineBody(seed, undefined, 'rupture'),
};
