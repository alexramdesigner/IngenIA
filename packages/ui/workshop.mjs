// Taller del participante: misión de la fase activa y formulario de su entregable AI-DSE.
import { PHASES, STAGE_LABELS, MAX_ITERATIONS, LOOP_TO } from '/packages/shared/phases.mjs';
import { PROJECT_TYPES, ARCHITECTURES, FINDING_CATEGORIES, SEVERITIES, RELEASE_DECISIONS, DELIVERABLE_STATUS, projectType } from '/packages/shared/projects.mjs';
import { deliverableText } from '/packages/shared/deliverable-text.mjs';
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const FIELD_LABELS = { projectType: 'Proyecto', user: 'Usuario principal', problem: 'Problema', features: 'Funciones prioritarias', constraint: 'Restricción o supuesto', stories: 'Historias de usuario', criteria: 'Criterios de aceptación', negative: 'Escenario negativo', architecture: 'Arquitectura', data: 'Datos principales', accessFlow: 'Flujo de acceso', authRule: 'Regla de autorización', justification: 'Justificación', matches: 'Qué coincide', differs: 'Qué difiere', category: 'Categoría', severity: 'Severidad', description: 'Hallazgo', impact: 'Impacto', regressionTest: 'Prueba de regresión', decision: 'Decisión', conditions: 'Condiciones', residualRisk: 'Riesgo residual', rollback: 'Plan de reversión', improvement: 'Mejora', checklist: 'Confirmación' };

// Lee el formulario: los campos "nombre.0", "nombre.1"… se envían como listas.
export function readActivityForm(form, submitter) {
  const data = {};
  for (const [key, value] of new FormData(form)) {
    const [name, index] = key.split('.');
    if (index === undefined) data[name] = value;
    else (data[name] ??= [])[Number(index)] = value;
  }
  if (form.querySelector('[name=checklist]')) data.checklist = form.elements.checklist.checked;
  if (submitter?.value === 'draft') data.draft = true;
  return data;
}

// Prompt inicial a partir de lo acordado: las historias y criterios alimentan la construcción.
export function composedPrompt(project) {
  const [d1, d2, d3] = [1, 2, 3].map(phase => project.deliverables?.[phase]?.data ?? {});
  const list = items => (items ?? []).filter(Boolean).join('; ');
  return [
    `Contexto: ${projectType(d1.projectType)?.title ?? 'proyecto del equipo'} para ${d1.user ?? 'el usuario principal'}. Problema: ${d1.problem ?? ''}`,
    `Alcance: ${list(d1.features)}. Restricción: ${d1.constraint ?? ''}`,
    `Historias de usuario: ${list(d2.stories)}`,
    `Criterios de aceptación: ${list(d2.criteria)}. Caso de error: ${d2.negative ?? ''}`,
    `Arquitectura acordada: ${ARCHITECTURES.find(a => a.id === d3.architecture)?.title ?? ''}. Datos: ${d3.data ?? ''}. Acceso: ${d3.accessFlow ?? ''}. Autorización: ${d3.authRule ?? ''}`,
    'Límites: sin secretos reales; comprobar permisos en el servidor.'
  ].join('\n').slice(0, 6000);
}

export function workshopActivity(s, { draft, online, busy }) {
  const p = s.team.project ?? {};
  const phase = PHASES.find(item => item.id === s.activePhase);
  const team = `<p class="muted">${esc(s.team.name)} · ${s.team.memberCount}/${s.team.maxMembers} integrantes · Trabajo compartido del equipo</p>`;
  if (!phase) return `<section class="card">${team}<p>${s.status === 'FINISHED' ? 'El taller terminó. Aquí queda el trabajo de tu equipo.' : 'Bienvenido en un momento daremos inicio al taller.'}</p></section>${teamWork(p)}${incidentHistory(s.incidents ?? [])}`;
  const deliverable = p.deliverables?.[phase.id];
  const data = deliverable?.data ?? {};
  const value = (name, index) => esc(index === undefined ? draft[name] ?? data[name] ?? '' : draft[`${name}.${index}`] ?? data[name]?.[index] ?? '');
  const area = (name, label, max, hint = '') => `<label>${label}<textarea name="${name}" maxlength="${max}" placeholder="${esc(hint)}">${value(name)}</textarea></label>`;
  const line = (name, label, max, index, hint = '') => `<label>${label}<input name="${index === undefined ? name : `${name}.${index}`}" maxlength="${max}" value="${value(name, index)}" placeholder="${esc(hint)}" autocomplete="off"></label>`;
  const select = (name, label, options) => `<label>${label}<select name="${name}"><option value="">Selecciona…</option>${options.map(([id, title]) => `<option value="${esc(id)}" ${String(draft[name] ?? data[name] ?? '') === id ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></label>`;
  const editable = s.status === 'ACTIVE' && s.phaseStage === 'PRACTICE' && online;
  const actions = `<div class="actions"><button type="submit" value="draft" class="secondary" ${busy ? 'disabled' : ''}>Guardar borrador</button><button type="submit" value="submit" ${busy ? 'disabled' : ''}>Enviar entrega</button></div>`;
  const form = fields => `<form id="activity" data-action="${phase.action}"><fieldset ${editable ? '' : 'disabled'}><legend>Entrega · ${esc(phase.title)}</legend>${fields}${actions}</fieldset></form>`;
  const iteration = s.iteration ?? 1;
  const versions = (p.versions ?? []).filter(v => v.phase === LOOP_TO);
  const latest = versions.filter(v => (v.iteration ?? 1) === iteration).at(-1);
  let body = '';
  switch (phase.id) {
    case 1: body = form(`${select('projectType', 'Proyecto del equipo', PROJECT_TYPES.map(t => [t.id, t.title]))}${area('user', 'Usuario principal', 400, '¿Quién usará la app? Sé concreto.')}${area('problem', 'Problema que enfrenta', 600, '¿Qué le ocurre hoy y por qué importa?')}<fieldset class="field-group"><legend>Tres funciones prioritarias</legend>${[0, 1, 2].map(i => line('features', `Función ${i + 1}`, 200, i)).join('')}</fieldset>${area('constraint', 'Restricción o supuesto por validar', 400)}`); break;
    case 2: body = form(`<fieldset class="field-group"><legend>Historias de usuario</legend>${[0, 1].map(i => line('stories', `Historia ${i + 1}`, 400, i, 'Como… quiero… para…')).join('')}</fieldset><fieldset class="field-group"><legend>Criterios de aceptación observables</legend>${[0, 1, 2].map(i => line('criteria', `Criterio ${i + 1}`, 300, i, 'Dado… cuando… entonces…')).join('')}</fieldset>${area('negative', 'Caso alterno o de error', 400, '¿Qué debe pasar si algo sale mal?')}`); break;
    case 3: body = `<section class="card"><h3>Alternativas simuladas</h3><ul class="option-list">${ARCHITECTURES.map(a => `<li><strong>${esc(a.title)}</strong><span>${esc(a.summary)}</span></li>`).join('')}</ul></section>` + form(`${select('architecture', 'Arquitectura elegida', ARCHITECTURES.map(a => [a.id, a.title]))}${area('data', 'Datos principales', 400)}${area('accessFlow', 'Flujo de acceso', 400, '¿Cómo entra el usuario y qué valida el sistema?')}${area('authRule', 'Regla de autorización', 300, '¿Quién puede ver o cambiar qué?')}${area('justification', 'Justificación de la decisión', 600)}`); break;
    case 4: body = `<form id="generate"><fieldset ${editable ? '' : 'disabled'}><legend>Prompt para la IA simulada</legend>${iteration > 1 ? `<p><strong>Iteración ${iteration}/${MAX_ITERATIONS}.</strong> Ajusten el prompt con lo aprendido en la verificación.</p>` : ''}<label>Prompt<textarea name="prompt" maxlength="6000" class="prompt-area">${esc(draft.prompt ?? latest?.prompt ?? versions.at(-1)?.prompt ?? composedPrompt(p))}</textarea></label><p class="muted">Incluye contexto, alcance, arquitectura y criterios de aceptación. Fixture determinista, sin IA externa. Máximo tres generaciones por iteración.</p><button type="submit" ${busy ? 'disabled' : ''}>Generar prototipo simulado</button></fieldset></form>`
      + (latest ? `<section class="card"><h3>Versión ${versions.length} · SIMULACIÓN</h3>${latest.generatedType && latest.generatedType !== latest.projectType ? '<p class="incident-flag">Comparen este resultado con el proyecto que pidieron antes de continuar.</p>' : ''}<pre>${esc(latest.code)}</pre></section>` + form(`${area('matches', 'Qué coincide con lo pedido', 600)}${area('differs', 'Qué difiere o falta', 600)}`) : '<p class="muted">Generen una versión para revisar su correspondencia con los criterios.</p>'); break;
    case 5: body = (latest ?? versions.at(-1) ? `<section class="card"><h3>Escenarios de prueba simulados</h3><ul class="scenario-list">${(latest ?? versions.at(-1)).scenarios.map(sc => `<li class="${sc.result === 'PASS' ? 'is-pass' : 'is-fail'}"><strong>${sc.result === 'PASS' ? 'Pasa' : 'Falla'}</strong><span>${esc(sc.name)}</span><small>${esc(sc.detail)}</small></li>`).join('')}</ul></section>` : '')
      + form(`${select('category', 'Categoría', FINDING_CATEGORIES.map(c => [c, c]))}${select('severity', 'Severidad', SEVERITIES.map(c => [c, c]))}${area('description', 'Hallazgo y evidencia', 600)}${area('impact', 'Impacto', 400)}${area('regressionTest', 'Prueba de regresión', 600, 'Qué prueba demostraría que quedó corregido')}`); break;
    case 6: body = form(`${select('decision', 'Decisión', RELEASE_DECISIONS.map(d => [d.id, d.title]))}${area('conditions', 'Condiciones (si publican con condiciones)', 400)}${area('residualRisk', 'Riesgo residual', 400)}${area('rollback', 'Plan de reversión', 400)}${area('improvement', 'Mejora para la siguiente iteración', 400)}<label class="checkbox-line"><input type="checkbox" name="checklist" ${(draft.checklist ?? data.checklist) ? 'checked' : ''}> Revisamos pendientes, riesgos y limitaciones de la simulación.</label>`)
      + (deliverable?.status === 'submitted' || deliverable?.status === 'accepted' ? '<button id="report" class="secondary">Descargar reporte del equipo</button>' : ''); break;
  }
  const stageNote = s.status === 'PAUSED' ? 'La sesión está en pausa.' : { THEORY: 'Sigue la explicación del conferencista. La práctica se habilitará al terminar.', REFLECTION: 'Reflexión: compartan sus hallazgos con el grupo. La entrega queda en lectura.', CLOSED: 'Fase cerrada: solo lectura.' }[s.phaseStage] ?? '';
  const status = deliverable ? `<p class="deliverable-status status-${deliverable.status}" role="status"><strong>${DELIVERABLE_STATUS[deliverable.status]}</strong>${deliverable.review?.comment ? ` · ${esc(deliverable.review.comment)}` : ''}</p>` : '';
  const incidents = s.incidents ?? [];
  return `${incidents.filter(i => i.phase === phase.id).map(i => incidentPanel(i, { editable, busy, draft })).join('')}<section class="card phase-brief"><p class="muted">Fase ${phase.id}/${PHASES.length} · ${STAGE_LABELS[s.phaseStage] ?? ''}</p><h2>${esc(phase.title)}</h2><p><strong>Objetivo:</strong> ${esc(phase.objective)}</p>${s.phaseStage === 'THEORY' ? `<p>${esc(phase.theory)}</p>` : ''}<ol class="phase-steps">${phase.instructions.map(i => `<li>${esc(i)}</li>`).join('')}</ol><p><strong>Evidencia esperada:</strong> ${esc(phase.deliverable)}</p><p><strong>Terminada cuando:</strong> ${esc(phase.acceptanceCriteria)}</p>${stageNote ? `<p class="phase-moment">${stageNote}</p>` : ''}</section><section class="card">${team}${status}${body}</section>${teamWork(p, phase.id)}${incidentHistory(incidents.filter(i => i.phase !== phase.id))}`;
}
// Entregas de las demás fases, en lectura, para que el equipo mantenga la trazabilidad.
function teamWork(project, except) {
  const items = PHASES.filter(phase => phase.id !== except && project.deliverables?.[phase.id]).map(phase => `<details><summary>${phase.id}. ${esc(phase.title)} · ${DELIVERABLE_STATUS[project.deliverables[phase.id].status]}</summary><pre class="deliverable-text">${esc(deliverableText(project, phase.id))}</pre></details>`);
  return items.length ? `<section class="card"><h2>Trabajo del equipo</h2>${items.join('')}</section>` : '';
}

const INCIDENT_STATUS = { revealed: 'Por responder', acknowledged: 'Respuesta registrada', resolved: 'Resuelto', discussed: 'Discutido en el auditorio' };
// Incidente revelado para el equipo: decidir y justificar; la respuesta esperada llega en la reflexión.
function incidentPanel(incident, { editable, busy, draft }) {
  const open = editable && ['revealed', 'acknowledged'].includes(incident.status);
  const chosen = draft[`incident-${incident.code}-choice`] ?? incident.response?.choice;
  return `<section class="card incident-card severity-${esc(incident.severity.toLowerCase())}" aria-label="Incidente de tu equipo">
    <p class="incident-eyebrow"><span>Incidente de tu equipo</span><span class="incident-severity">${esc(incident.severity)} · ${esc(incident.category)}</span></p>
    <h2>${esc(incident.title)}</h2>
    <p><strong>Síntoma:</strong> ${esc(incident.symptom)}</p><p><strong>Contexto:</strong> ${esc(incident.context)}</p><p>${esc(incident.privateDescription)}</p><p class="muted">${esc(incident.impact)}</p>
    <form class="incident-form" data-incident="${esc(incident.code)}"><fieldset ${open ? '' : 'disabled'}><legend>¿Qué decide el equipo?</legend>
      ${incident.choices.map(choice => `<label class="incident-choice"><input type="radio" name="choice" value="${esc(choice.id)}" ${chosen === choice.id ? 'checked' : ''} required> <span>${esc(choice.text)}</span></label>`).join('')}
      <label>Justificación<textarea name="justification" maxlength="600" placeholder="¿Por qué esta decisión?">${esc(draft[`incident-${incident.code}-justification`] ?? incident.response?.justification ?? '')}</textarea></label>
      <button type="submit" ${busy ? 'disabled' : ''}>${incident.response ? 'Actualizar respuesta' : 'Registrar respuesta'}</button>
    </fieldset></form>
    <p class="deliverable-status status-${incident.status === 'revealed' ? 'needs_review' : 'submitted'}">${INCIDENT_STATUS[incident.status]}</p>
    ${incidentFeedback(incident)}
  </section>`;
}
function incidentFeedback(incident) {
  const f = incident.feedback;
  if (!f) return '';
  return `<div class="incident-feedback"><h3>Aprendizaje</h3><p><strong>${esc(f.learningPoint)}</strong></p><p>${esc(f.expectedReasoning)}</p><p class="muted">Se pudo prevenir o detectar en: ${esc(f.preventedIn.join(', '))} · Controles: ${esc(f.relatedControls.join(', '))}</p></div>`;
}
function incidentHistory(incidents) {
  if (!incidents.length) return '';
  return `<section class="card"><h2>Incidentes del equipo</h2>${incidents.map(i => `<details><summary>${esc(i.code)} · ${esc(i.title)} · ${INCIDENT_STATUS[i.status]}</summary><p>${esc(i.privateDescription)}</p>${i.response ? `<p><strong>Decisión:</strong> ${esc(i.choices.find(c => c.id === i.response.choice)?.text ?? '')}<br>${esc(i.response.justification)}</p>` : ''}${incidentFeedback(i)}</details>`).join('')}</section>`;
}
