// Politiques comparées dans le banc d'essai de découverte.
export const POLICIES = {
  oracle: { label: 'Oracle (connaît la vérité)' },
  habit: { label: 'Habitude (prix fixe 4 €)' },
  'v1-gele': { label: 'CORTEX v1 tel que fusionné (gelé)' },
  'v1-infra': { label: 'v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé' },
  oubli: { label: 'Fenêtre glissante 60 j, sans hypothèses' },
  'ferme+detect': { label: 'Vocabulaire fermé + détecteur générique + recherche de fond' },
  v2: { label: 'CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond' },
};
export const AGENT_OPTS = {
  'v1-infra': { grammar: 'closed', omnibus: false, background: false },
  oubli: { grammar: 'closed', omnibus: false, background: false, hypotheses: false, dreaming: false, window: 60 },
  'ferme+detect': { grammar: 'closed', omnibus: true, background: true },
  v2: { grammar: 'open', omnibus: true, background: true },
};

