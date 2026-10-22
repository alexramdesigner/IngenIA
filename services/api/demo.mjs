import { ApiError } from './domain.mjs';
const sample = `// Ejemplo educativo; credencial ficticia, nunca válida.\nconst DEMO_KEY = 'FICTICIA_NO_USAR';\nfunction readRecord(id) { return records[id]; }\nfunction debug(user) { console.log(user); }`;
const repaired = `// Ejemplo educativo de mitigación. Requiere implementación real.\nfunction readRecord(actor, record) {\n  if (record.ownerId !== actor.id) throw new Error('FORBIDDEN');\n  return { title: record.title };\n}\nfunction debug() { console.info('record.read'); }`;
export const findings = [
  { kind: 'credential', severity: 'HIGH', evidence: "DEMO_KEY = 'FICTICIA_NO_USAR'", consequence: 'Una credencial real en el cliente quedaría expuesta.', mitigation: 'Gestionar secretos exclusivamente en el servidor.' },
  { kind: 'authorization', severity: 'HIGH', evidence: 'return records[id]', consequence: 'Falta comprobar el propietario del recurso.', mitigation: 'Autorizar cada acceso en el backend.' },
  { kind: 'logs', severity: 'MEDIUM', evidence: 'console.log(user)', consequence: 'Los registros podrían contener datos personales.', mitigation: 'Registrar solo eventos mínimos sin datos personales.' }
];
export function startIteration(project) {
  // Conserva prompt e historial de versiones; auditoría y correcciones se repiten.
  const p = structuredClone(project);
  p.submissions = p.submissions?.[1] ? { 1: true } : {};
  delete p.generated; delete p.audited; delete p.fixed; delete p.findings; delete p.justification; delete p.verification; delete p.verdict;
  return p;
}
export function applyDemo(project, action, body, { iteration = 1 } = {}) {
  const p = structuredClone(project);
  p.versions ??= [];
  p.submissions ??= {};
  if (action === 'idea') {
    if (typeof body.prompt !== 'string' || body.prompt.trim().length < 20 || body.prompt.length > 6000) throw new ApiError(400, 'PROMPT_LENGTH');
    p.prompt = body.prompt.trim();
    // Reabrir ideación conserva artefactos históricos pero invalida entregas posteriores.
    p.submissions = { 1: true };
    delete p.generated; delete p.audited; delete p.fixed; delete p.verdict;
  }
  if (action === 'generate') {
    if (!p.submissions[1]) throw new ApiError(409, 'IDEA_REQUIRED');
    if (p.versions.filter(v => v.phase === 2 && (v.iteration ?? 1) === iteration).length >= 3) throw new ApiError(429, 'ITERATION_LIMIT');
    if (body.prompt !== undefined) {
      if (typeof body.prompt !== 'string' || body.prompt.trim().length < 20 || body.prompt.length > 6000) throw new ApiError(400, 'PROMPT_LENGTH');
      p.prompt = body.prompt.trim();
    }
    p.generated = true; p.audited = false; p.fixed = false;
    p.versions.push({ phase: 2, iteration, prompt: p.prompt, code: sample, sourceMode: 'DEMO', createdAt: Date.now() });
    p.submissions = { 1: true, 2: true };
  }
  if (action === 'audit') {
    if (!p.generated) throw new ApiError(409, 'PROTOTYPE_REQUIRED');
    if (typeof body.justification !== 'string' || body.justification.trim().length < 10 || body.justification.length > 3000) throw new ApiError(400, 'JUSTIFICATION_REQUIRED');
    p.audited = true; p.fixed = false; p.findings = findings;
    p.justification = body.justification; p.submissions = { 1: true, 2: true, 3: true };
  }
  if (action === 'fix') {
    if (!p.audited) throw new ApiError(409, 'AUDIT_REQUIRED');
    if (p.fixed) return p;
    p.fixed = true;
    p.versions.push({ phase: 4, code: repaired, sourceMode: 'DEMO', createdAt: Date.now() });
    p.submissions = { 1: true, 2: true, 3: true, 4: true };
    p.verification = 'Reglas educativas del fixture satisfechas; no constituye auditoría real.';
  }
  if (action === 'publish') {
    if (!p.fixed) throw new ApiError(409, 'FIX_REQUIRED');
    if (!['GO', 'NO_GO'].includes(body.verdict) || body.checklist !== true || typeof body.justification !== 'string' || body.justification.trim().length < 10 || body.justification.length > 3000) throw new ApiError(400, 'CHECKLIST_REQUIRED');
    p.verdict = body.verdict; p.finalReason = body.justification; p.submissions[5] = true;
    p.publication = body.verdict === 'GO' ? 'Presentación estática en demo privada; sin despliegue público.' : 'NO GO: prototipo no publicado.';
  }
  return p;
}
