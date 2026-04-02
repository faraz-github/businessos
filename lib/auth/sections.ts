// ============================================================
// Business OS — Section definitions (shared, client + server safe)
// No server-only imports. Safe to use anywhere.
// ============================================================

export const ALL_SECTIONS = {
  personal: ['home', 'social', 'compose', 'paperwork', 'clients', 'feedback', 'support', 'finance'],
  agency: ['home', 'bd-pipeline', 'social', 'compose', 'paperwork', 'clients', 'feedback', 'support', 'finance'],
} as const;

export type PersonalSection = typeof ALL_SECTIONS.personal[number];
export type AgencySection = typeof ALL_SECTIONS.agency[number];

export const SECTION_LABELS: Record<string, string> = {
  home: 'Home',
  social: 'Social & Brand',
  compose: 'Composers',
  paperwork: 'Paperwork',
  clients: 'All Clients',
  feedback: 'Feedback',
  support: 'Support',
  finance: 'Finance',
  'bd-pipeline': 'BD Pipeline',
};
