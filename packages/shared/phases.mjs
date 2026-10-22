export const PHASES = [
  { id: 1, title: 'Ideación', mission: 'Definan en equipo el problema, el usuario y el prompt del proyecto que eligieron al inicio.', action: 'idea' },
  { id: 2, title: 'Generar app', mission: 'Genera y examina un prototipo educativo simulado.', action: 'generate' },
  { id: 3, title: 'Auditar', mission: 'Identifica y explica los riesgos del escenario educativo.', action: 'audit' },
  { id: 4, title: 'Corregir', mission: 'Aplica mitigaciones y compara las versiones.', action: 'fix' },
  { id: 5, title: 'Publicar', mission: 'Revisa el checklist y justifica GO / NO GO en la demo.', action: 'publish' }
];
// Ciclo de mejora: desde Corregir se puede volver a Generar hasta este número de iteraciones.
export const MAX_ITERATIONS = 3;
export const ACTION_PHASE = Object.fromEntries(PHASES.map(p => [p.action, p.id]));
