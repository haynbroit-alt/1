// Corps écrits après le gel du cerveau (protocole n° 2).
import { usineBody } from './usine.js';
import { abonnementBody } from './abonnement.js';
import { fermeBody } from './ferme.js';
import { hotelBody } from './hotel.js';
import { atelierBody } from './atelier.js';
export const BODIES = {
  usine: usineBody, abonnement: abonnementBody,
  // activités INCONNUES, écrites après le gel de la v4 (protocole n° 3)
  ferme: fermeBody, hotel: hotelBody, atelier: atelierBody,
  // variantes de contrôle de l'usine (développement v4)
  'usine-placebo': (seed) => usineBody(seed, undefined, 'placebo'),
  'usine-cadence': (seed) => usineBody(seed, undefined, 'cadence'),
  'usine-rupture': (seed) => usineBody(seed, undefined, 'rupture'),
};
