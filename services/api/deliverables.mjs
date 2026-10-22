import { ApiError } from './domain.mjs';
import { PHASES, LOOP_FROM, LOOP_TO } from '../../packages/shared/phases.mjs';
import { PROJECT_TYPES, ARCHITECTURES, FINDING_CATEGORIES, SEVERITIES, RELEASE_DECISIONS, isDelivered, projectType } from '../../packages/shared/projects.mjs';
export { deliverableText } from '../../packages/shared/deliverable-text.mjs';

// Reglas de cada entregable. En borrador solo se comprueban tipos y longitudes máximas.
const text = (min, max) => ({ kind: 'text', min, max });
const list = (count, min, max) => ({ kind: 'list', count, min, max });
const oneOf = values => ({ kind: 'enum', values });
const RULES = {
  discovery: { projectType: oneOf(PROJECT_TYPES.map(p => p.id)), user: text(10, 400), problem: text(10, 600), features: list(3, 3, 200), constraint: text(5, 400) },
  specification: { stories: list(2, 15, 400), criteria: list(3, 10, 300), negative: text(10, 400) },
  architecture: { architecture: oneOf(ARCHITECTURES.map(a => a.id)), data: text(10, 400), accessFlow: text(10, 400), authRule: text(10, 300), justification: text(10, 600) },
  construction: { matches: text(10, 600), differs: text(10, 600) },
  verification: { category: oneOf(FINDING_CATEGORIES), severity: oneOf(SEVERITIES), description: text(10, 600), impact: text(10, 400), regressionTest: text(10, 600) },
  delivery: { decision: oneOf(RELEASE_DECISIONS.map(d => d.id)), conditions: { ...text(10, 400), optional: true }, residualRisk: text(10, 400), rollback: text(10, 400), improvement: text(10, 400), checklist: { kind: 'accept' } }
};
const PREREQUISITES = {
  generate: [[1, 'DISCOVERY_REQUIRED'], [2, 'SPECIFICATION_REQUIRED'], [3, 'ARCHITECTURE_REQUIRED']],
  verification: [[4, 'CONSTRUCTION_REQUIRED']],
  delivery: [[5, 'VERIFICATION_REQUIRED']]
};
const invalid = field => new ApiError(400, 'DELIVERABLE_INVALID', { field });
function validate(rules, body, draft) {
  const data = {};
  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field];
    if (rule.kind === 'accept') { if (value !== undefined && typeof value !== 'boolean') throw invalid(field); if (!draft && value !== true) throw invalid(field); data[field] = value === true; continue; }
    if (value === undefined || value === '' || (Array.isArray(value) && value.every(item => item === ''))) {
      if (draft || rule.optional) continue;
      throw invalid(field);
    }
    if (rule.kind === 'enum') { if (!rule.values.includes(value)) throw invalid(field); data[field] = value; continue; }
    if (rule.kind === 'text') {
      if (typeof value !== 'string' || value.length > rule.max || (!draft && value.trim().length < rule.min)) throw invalid(field);
      data[field] = value.trim(); continue;
    }
    if (!Array.isArray(value) || value.length > rule.count || value.some(item => typeof item !== 'string' || item.length > rule.max)) throw invalid(field);
    const items = value.map(item => item.trim());
    if (!draft && (items.length !== rule.count || items.some(item => item.length < rule.min))) throw invalid(field);
    data[field] = items;
  }
  if (!draft && data.decision === 'PUBLISH_WITH_CONDITIONS' && !data.conditions) throw invalid('conditions');
  return data;
}
function save(project, phase, data, status, now) {
  const previous = project.deliverables[phase];
  const revisions = previous ? [...(previous.revisions ?? []), { status: previous.status, data: previous.data, at: previous.updatedAt }].slice(-10) : [];
  project.deliverables[phase] = { status, data, updatedAt: now, ...(status === 'submitted' ? { submittedAt: now } : {}), revisions };
  // Un cambio enviado en una fase anterior pide revisar la coherencia de las posteriores, sin borrarlas.
  if (status === 'submitted' && previous && JSON.stringify(previous.data) !== JSON.stringify(data)) {
    for (const later of PHASES.filter(p => p.id > phase)) {
      const deliverable = project.deliverables[later.id];
      if (!isDelivered(deliverable)) continue;
      deliverable.status = 'needs_review';
      deliverable.review = { decision: 'REQUEST_CHANGES', comment: `Cambió ${PHASES[phase - 1].title}: revisen la coherencia de esta entrega.`, at: now };
    }
  }
}

// Prototipo simulado: siempre corresponde al proyecto y a la arquitectura elegidos por el equipo.
const NAMES = { reservas: ['Reserva', 'Reservas'], tareas: ['Tarea', 'Tareas'], prestamos: ['Prestamo', 'Prestamos'], tutorias: ['Tutoria', 'Tutorias'] };
function prototype(typeId, architectureId) {
  const type = projectType(typeId), [one, many] = NAMES[typeId], store = many.toLowerCase();
  const architecture = ARCHITECTURES.find(a => a.id === architectureId);
  const header = `// SIMULACIÓN EDUCATIVA · Prototipo «${type.title}» generado por un fixture determinista, sin IA real.\n// Arquitectura: ${architecture.title}. Credenciales ficticias: nunca válidas.\n`;
  const core = `export function crear${one}(usuario, datos) {\n  if (!datos.titulo || !datos.fecha) throw new Error('DATOS_REQUERIDOS');\n  const registro = { id: ${store}.length + 1, propietarioId: usuario.id, ...datos };\n  ${store}.push(registro);\n  return registro;\n}\nexport function listarMis${many}(usuario) {\n  return ${store}.filter(registro => registro.propietarioId === usuario.id);\n}\nexport function obtener${one}(id) {\n  return ${store}.find(registro => registro.id === id);\n}\n`;
  const variants = {
    static: `const ${store} = JSON.parse(localStorage.getItem('${store}') ?? '[]');\nconst API_KEY = 'FICTICIA_NO_USAR';\n${core}export const guardar = () => localStorage.setItem('${store}', JSON.stringify(${store}));\n`,
    'client-api': `const ${store} = [];\nconst DB_PASSWORD = 'FICTICIA_NO_USAR';\n${core}app.get('/api/${store}/:id', (req, res) => res.json(obtener${one}(Number(req.params.id))));\n`,
    managed: `const ${store} = coleccion('${store}');\nconst SERVICE_KEY = 'FICTICIA_NO_USAR';\n${core}// reglas: match /${store}/{id} { allow read: if true; allow write: if request.auth != null; }\n`
  };
  const scenarios = [
    { name: `Crear una ${type.entity} con datos completos`, result: 'PASS', detail: 'Se guarda y aparece en la lista del usuario.' },
    { name: `Rechazar una ${type.entity} sin título o fecha`, result: 'PASS', detail: 'Responde DATOS_REQUERIDOS.' },
    { name: `Ver solo mis ${type.entities}`, result: 'PASS', detail: 'La lista filtra por propietario.' },
    { name: `Consultar la ${type.entity} de otro usuario por su id`, result: 'FAIL', detail: 'Devuelve el registro ajeno: no se comprueba el propietario.' }
  ];
  if (architectureId === 'static') scenarios.push({ name: `Ver las ${type.entities} desde otro dispositivo`, result: 'FAIL', detail: 'Los datos solo existen en este navegador.' });
  return { code: header + variants[architectureId], scenarios };
}

export function applyDemo(project, action, body, { iteration = 1, now = Date.now() } = {}) {
  const p = structuredClone(project ?? {});
  p.deliverables ??= {}; p.versions ??= [];
  for (const [phase, code] of PREREQUISITES[action] ?? []) if (!isDelivered(p.deliverables[phase])) throw new ApiError(409, code);
  if (action === 'generate') {
    if (typeof body.prompt !== 'string' || body.prompt.trim().length < 20 || body.prompt.length > 6000) throw new ApiError(400, 'PROMPT_LENGTH');
    if (p.versions.filter(v => v.phase === LOOP_TO && (v.iteration ?? 1) === iteration).length >= 3) throw new ApiError(429, 'ITERATION_LIMIT');
    const { projectType: typeId } = p.deliverables[1].data, { architecture } = p.deliverables[3].data;
    p.versions.push({ phase: LOOP_TO, iteration, prompt: body.prompt.trim(), projectType: typeId, architecture, ...prototype(typeId, architecture), sourceMode: 'DEMO', createdAt: now });
    save(p, LOOP_TO, { prompt: body.prompt.trim(), version: p.versions.length }, 'draft', now);
    return p;
  }
  const phase = PHASES.find(item => item.action === action)?.id;
  if (!phase) throw new ApiError(400, 'INVALID_COMMAND');
  const draft = body.draft === true;
  const data = validate(RULES[action], body, draft);
  if (action === 'construction') {
    const latest = p.versions.filter(v => v.phase === LOOP_TO && (v.iteration ?? 1) === iteration).at(-1);
    if (!latest) throw new ApiError(409, 'PROTOTYPE_REQUIRED');
    Object.assign(data, { prompt: latest.prompt, version: p.versions.lastIndexOf(latest) + 1 });
  }
  save(p, phase, data, draft ? 'draft' : 'submitted', now);
  return p;
}
// Nueva iteración: Construcción y Verificación se archivan y vuelven a empezar; el historial se conserva.
export function startIteration(project, previousIteration) {
  const p = structuredClone(project ?? {});
  p.deliverables ??= {}; p.archive ??= [];
  for (const phase of [LOOP_TO, LOOP_FROM]) {
    if (p.deliverables[phase]) p.archive.push({ phase, iteration: previousIteration, ...p.deliverables[phase] });
    delete p.deliverables[phase];
  }
  return p;
}
export function reviewDeliverable(project, phase, decision, comment, now = Date.now()) {
  const p = structuredClone(project ?? {});
  const deliverable = p.deliverables?.[phase];
  if (!deliverable || deliverable.status === 'draft') throw new ApiError(409, 'TEAM_WORK_REQUIRED');
  deliverable.status = decision === 'ACCEPT' ? 'accepted' : 'needs_review';
  deliverable.review = { decision, comment: comment ?? '', at: now };
  return p;
}
