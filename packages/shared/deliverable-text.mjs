import { ARCHITECTURES, RELEASE_DECISIONS, projectType } from './projects.mjs';
const label = (title, value) => value ? `${title}: ${value}` : '';
const bullets = items => (items ?? []).filter(Boolean).map(item => `• ${item}`).join('\n');
// Texto legible de una entrega para Studio y para proyectar cuando se da la palabra.
export function deliverableText(project, phase) {
  const d = project?.deliverables?.[phase]?.data;
  if (!d) return '';
  switch (phase) {
    case 1: return [label('Proyecto', projectType(d.projectType)?.title), label('Usuario', d.user), label('Problema', d.problem), d.features?.length ? `Funciones prioritarias:\n${bullets(d.features)}` : '', label('Restricción o supuesto', d.constraint)].filter(Boolean).join('\n\n');
    case 2: return [d.stories?.length ? `Historias de usuario:\n${bullets(d.stories)}` : '', d.criteria?.length ? `Criterios de aceptación:\n${bullets(d.criteria)}` : '', label('Escenario negativo', d.negative)].filter(Boolean).join('\n\n');
    case 3: return [label('Arquitectura', ARCHITECTURES.find(a => a.id === d.architecture)?.title), label('Datos principales', d.data), label('Flujo de acceso', d.accessFlow), label('Regla de autorización', d.authRule), label('Justificación', d.justification)].filter(Boolean).join('\n\n');
    case 4: return [label('Prompt', d.prompt), project.versions?.[d.version - 1]?.code, label('Coincide', d.matches), label('Difiere', d.differs)].filter(Boolean).join('\n\n');
    case 5: return [label('Hallazgo', d.description), label('Clasificación', [d.category, d.severity].filter(Boolean).join(' · ')), label('Impacto', d.impact), label('Prueba de regresión', d.regressionTest)].filter(Boolean).join('\n\n');
    case 6: return [label('Decisión', RELEASE_DECISIONS.find(r => r.id === d.decision)?.title), label('Condiciones', d.conditions), label('Riesgo residual', d.residualRisk), label('Plan de reversión', d.rollback), label('Mejora para la siguiente iteración', d.improvement)].filter(Boolean).join('\n\n');
  }
  return '';
}
