import { icon } from '/packages/ui/icons.mjs';
import { setupParticipantNav } from '/packages/ui/participant-nav.mjs';
import { PHASES, MAX_ITERATIONS, STAGE_LABELS, LOOP_FROM, LOOP_TO } from '/packages/shared/phases.mjs';
import { DELIVERABLE_STATUS } from '/packages/shared/projects.mjs';
import { workshopActivity, readActivityForm, FIELD_LABELS } from '/packages/ui/workshop.mjs';
import { PRODUCTION_URL, productionQr } from '/packages/ui/qr.mjs';
const view = document.body.dataset.view;
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
let connectionText = 'Sin conectar';
function setConnection(text) {
  connectionText = text;
  const element = document.querySelector('#connection');
  if (element) element.textContent = text;
}
// Encuesta de satisfacción: completar con el enlace y la imagen QR definitivos.
const SURVEY_URL = '';
const SURVEY_QR = ''; // p. ej. '/packages/ui/assets/encuesta-qr.png'
const WAITING_MESSAGE = 'Bienvenido en un momento daremos inicio al taller.';
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let current, stream, sessionId, offset = 0, online = false, busy = false;
let draft = {}, pending = null;
let participantTab = 'activities';
let notesDraft, savingNotes = false;
let speakerPhase=null,savingSpeakerNotes=false,reviewBusy=false,adminBusy=false;
let speakerDrafts={};
let studioTab='control',studioMenuOpen=false,studioEvents=[],studioCollapsed=false;
try{studioCollapsed=localStorage.getItem('ingenia.studio.sidebar')==='collapsed';}catch{}
if (view === 'participant') setupParticipantNav(document.querySelector('#participant-nav'));
function navigateParticipant(destination) {
  if (!current || !['home','questions','activities','notes','profile','workshop','survey'].includes(destination)) return;
  participantTab = destination;
  render(current);
  window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('keydown', event => { if (view === 'presenter' && event.key === 'Escape' && studioMenuOpen) { setStudioMenu(false); document.querySelector('#studio-menu')?.focus(); } });
document.addEventListener('participant:navigate', event => { if(view === 'participant') navigateParticipant(event.detail); });
const errors = { REVIEW_VERSION_CONFLICT:'La revisión cambió desde otro Studio. Revisa la selección e inténtalo de nuevo.', REVIEW_PRACTICE_REQUIRED:'Habilita la práctica antes de proyectar un equipo.', TEAM_WORK_REQUIRED:'Este equipo todavía no ha guardado su trabajo de esta fase.', TEAM_NOT_FOUND:'El equipo no pertenece a este horario.', MEMBER_NOT_FOUND:'Este integrante ya no está registrado.', PHASE_NOTE_VERSION_CONFLICT:'Estas notas cambiaron en otro Studio. Tu borrador se conserva; recarga las notas guardadas antes de reemplazarlas.', INVALID_PHASE_NOTE:'Las notas de cada fase admiten hasta 6000 caracteres.', INVALID_TRANSITION:'Esta acción no está disponible en el momento actual.', IDENTITY_REQUIRED: 'Escribe tu nombre completo y un correo válido.', TEAM_CHANGE_NOT_ALLOWED: 'Ya estás registrado en otro equipo de este horario. Ingresa con el nombre de tu equipo original.', IDENTITY_MISMATCH: 'Este navegador pertenece a otro participante. Usa otro perfil para registrar a otra persona.', NOTES_READ_ONLY: 'Las notas están en lectura mientras la sesión está pausada o finalizada.', NOTE_VERSION_CONFLICT: 'Las notas cambiaron en otra pestaña. Copia tu borrador y recarga antes de guardar.', INVALID_NOTE: 'Las notas admiten hasta 3000 caracteres.', PHASE_LOCKED: 'Esta acción está bloqueada. Espera la fase indicada por el conferencista.', VERSION_CONFLICT: 'La sesión cambió. Revisa el estado actualizado y vuelve a intentarlo.', INVALID_CREDENTIALS: 'Credenciales incorrectas o enlace expirado.', INVALID_JOIN: 'Revisa el horario y el nombre del equipo.', TEAM_FULL: 'Este equipo ya tiene seis integrantes. Elige otro equipo o crea uno nuevo.', TEAM_SELECTION_CHANGED: 'El nombre cambió. Selecciona de nuevo el equipo sugerido.', ALREADY_IN_TEAM: 'Ya perteneces a otro equipo de esta sala. Conserva tu acceso actual.', INCOMPLETE_TEAMS: 'Hay equipos con entregas pendientes. Confirma antes de avanzar.', PROMPT_LENGTH: 'El prompt necesita entre 20 y 6000 caracteres.', DELIVERABLE_INVALID: 'Revisa la entrega: falta información o un campo es muy corto.', DISCOVERY_REQUIRED: 'Primero envíen la ficha de Descubrimiento.', SPECIFICATION_REQUIRED: 'Primero envíen la Especificación.', ARCHITECTURE_REQUIRED: 'Primero envíen la decisión de Arquitectura.', CONSTRUCTION_REQUIRED: 'Primero envíen la revisión de Construcción con IA.', VERIFICATION_REQUIRED: 'Primero envíen el hallazgo de Verificación.', PROTOTYPE_REQUIRED: 'Generen una versión del prototipo en esta iteración antes de revisarla.', INCIDENT_NOT_FOUND: 'El incidente no está asignado a este equipo.', INCIDENT_ALREADY_ASSIGNED: 'Ese incidente ya está asignado al equipo.', INCIDENT_PHASE_TAKEN: 'El equipo ya tiene un incidente en esta fase. Quítalo antes de asignar otro.', INCIDENT_PHASE_MISMATCH: 'Solo se puede revelar o compartir durante la fase del incidente.', INCIDENT_HAS_RESPONSE: 'El equipo ya respondió; no se puede ocultar.', INCIDENT_NOT_REVEALED: 'Primero revela el incidente al equipo.', INCIDENT_SHARE_CONFLICT: 'La intervención cambió desde otro Studio. Revisa el estado e inténtalo de nuevo.', INCIDENT_NOT_SHARED: 'No hay un incidente en pantalla.', INCIDENT_CLOSED: 'Este incidente ya se cerró.', INCIDENT_RESPONSE_INVALID: 'Elige una opción y justifica la decisión (mínimo 10 caracteres).', RATE_LIMITED: 'Demasiados intentos. Espera un minuto.', ITERATION_LIMIT: 'Se alcanzó el límite de esta iteración.', UNAUTHENTICATED: 'La sesión de acceso expiró. Vuelve a ingresar.' };
async function api(path, data) {
  const res = await fetch(({ presenter: '/api/studio', projector: '/api/projection', participant: '/api' })[view] + path, { method: data ? 'POST' : 'GET', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  const result = await res.json();
  if (!res.ok) { const error = new Error((errors[result.error] ?? result.error) + (result.field ? ` Campo: ${FIELD_LABELS[result.field] ?? result.field}.` : '')); error.code = result.error; throw error; }
  return result;
}
function joinIcon(kind) { return icon(kind); }
function participantLogin() {
  return `<section class="join-intro"><h1>Únete al taller</h1></section>
  <form id="login" class="join-form">
    <section class="join-card" aria-label="Inscripción al taller">
      <label class="join-field"><span class="field-icon">${icon('person')}</span><span class="field-content"><span class="field-label">Nombre completo</span><input name="fullName" required minlength="3" maxlength="120" autocomplete="name" placeholder="Ej. Juan Pérez"></span></label>
      <label class="join-field"><span class="field-icon">${icon('email')}</span><span class="field-content"><span class="field-label">Correo institucional</span><input name="email" type="email" required maxlength="254" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="tu@ucundinamarca.edu.co"></span></label>
      <label class="join-field"><span class="field-icon">${joinIcon('person')}</span><span class="field-content"><span class="field-label">Nombre de tu equipo</span><input name="name" required maxlength="60" autocomplete="off" placeholder="Ej. Los Innovadores" aria-describedby="team-hint team-search-status" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="team-suggestions"></span></label>
      <input type="hidden" name="teamId" value=""><ul id="team-suggestions" role="listbox" aria-label="Equipos de tu sala" hidden></ul><p id="team-search-status" class="join-hint" role="status"></p>
      <h2>Selecciona tu sesión</h2>
      <label class="session-select"><span class="field-icon">${joinIcon('calendar')}</span><span class="sr-only">Horario del taller, hora Colombia</span><select name="sessionId" required><option value="" disabled selected>Elige un horario</option><option value="tarde">2:00–4:00 p. m.</option><option value="noche">6:00–8:00 p. m.</option></select></label>
      <label class="demo-accept"><input type="checkbox" required><span>Entiendo que participaré en un taller de simulación educativa.</span></label>
    </section>
    <button class="join-submit" type="submit">Unirme al taller ${icon('forward')}</button>
    <p class="join-caption">18 de noviembre de 2026 · Extensión Chía</p>
  </form>`;
}
function bindTeamSearch() {
  const form = document.querySelector('#login');
  const name = form.elements.name, session = form.elements.sessionId;
  const selected = form.elements.teamId;
  const list = document.querySelector('#team-suggestions');
  const status = document.querySelector('#team-search-status');
  let timer, revision = 0, matches = [], active = -1;
  function clear() { list.hidden = true; list.innerHTML = ''; name.setAttribute('aria-expanded','false'); name.removeAttribute('aria-activedescendant'); active = -1; }
  function choose(index) {
    const team = matches[index];
    if (!team || team.full) return;
    revision++; clearTimeout(timer);
    name.value = team.name; session.value = team.sessionId; selected.value = team.id; clear();
    status.textContent = `${team.name} · ${team.sessionTitle} · ${team.memberCount}/6 integrantes. Te unirás a este equipo.`;
    name.focus();
  }
  async function search(version) {
    if (!name.isConnected) return;
    if (!name.value.trim()) { status.textContent = ''; return; }
    status.textContent = 'Buscando equipos…';
    try {
      const result = await api('/team-search',{...(session.value ? {sessionId:session.value} : {}),query:name.value.trim()});
      if (revision !== version || !name.isConnected) return;
      matches = result.teams;
      clear();
      list.innerHTML = matches.map((team,index)=>`<li><button type="button" role="option" id="team-option-${index}" aria-selected="false" tabindex="-1" data-index="${index}" ${team.full ? 'disabled' : ''}><span>${esc(team.name)}<span class="team-session-label">${esc(team.sessionTitle)}</span></span><small>${team.memberCount}/6${team.full ? ' · Completo' : ' · Unirme'}</small></button></li>`).join('');
      list.hidden = matches.length === 0; name.setAttribute('aria-expanded',String(matches.length > 0));
      status.textContent = matches.length ? 'Selecciona tu equipo para compartir trabajo y estadísticas.' : 'No hay coincidencias. Al ingresar se creará un equipo con este nombre.';
    } catch(error) { if (revision === version) status.textContent = error.message; }
  }
  function schedule() { revision++; selected.value=''; clear(); clearTimeout(timer); timer=setTimeout(()=>search(revision),250); }
  for (const field of [name,session]) field.addEventListener('input',schedule);
  session.addEventListener('change',schedule);
  name.addEventListener('focus',()=>{ if (!selected.value) schedule(); });
  list.addEventListener('click',event=>{ const button=event.target.closest('[data-index]'); if(button) choose(Number(button.dataset.index)); });
  name.addEventListener('keydown',event=>{
    if(event.key==='Escape') { revision++; clear(); return; }
    if(list.hidden) return;
    if(event.key==='Enter' && active>=0) { event.preventDefault(); choose(active); return; }
    if(!['ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const available=matches.map((team,i)=>team.full ? -1 : i).filter(i=>i>=0);
    if(!available.length) return;
    const position=available.indexOf(active);
    active=available[(position+(event.key==='ArrowDown'?1:-1)+available.length)%available.length];
    for(const option of list.querySelectorAll('[role=option]')) option.setAttribute('aria-selected',String(Number(option.dataset.index)===active));
    name.setAttribute('aria-activedescendant',`team-option-${active}`);
  });
}
function login() {
  current = null;
  notesDraft = undefined;
  speakerPhase=null;speakerDrafts={};
  stream?.close(); stream = null; online = false; sessionId = null;
  setConnection('Sin conectar');
  if (view === 'presenter') { document.body.dataset.screen = 'login'; studioMenuOpen = false; studioEvents = []; }
  if (view === 'participant') { document.body.dataset.screen = 'login'; participantTab = 'activities'; document.dispatchEvent(new CustomEvent('participant:screen',{detail:'login'})); }
  const form = view === 'presenter' ? `<label>Grupo<select name="sessionId"><option value="tarde">14:00–16:00 · Colombia</option><option value="noche">18:00–20:00 · Colombia</option></select></label><label>Contraseña del conferencista<input name="password" type="password" autocomplete="current-password" required minlength="12"></label>` : `<label>Código de sala<input name="code" autocomplete="off" required maxlength="40"></label><label>Nombre o seudónimo del equipo<input name="name" required maxlength="60" autocomplete="off"></label><p class="muted">Hasta seis integrantes por equipo. Conserva este navegador para recuperar tu acceso.</p>`;
  app.innerHTML = `<h1>${view === 'presenter' ? 'Control Center' : view === 'projector' ? 'Pantalla de auditorio' : 'Tu primera app empieza con una idea.'}</h1><p>Un taller, seis fases AI-DSE. El conferencista marca el ritmo.</p><section class="card">${view === 'projector' ? '<p>Abre aquí el enlace privado generado desde Control Center, desde Studio.</p>' : `<form id="login">${form}<button>Ingresar</button></form>`}</section>`;
  if (view === 'participant') { app.innerHTML = participantLogin(); bindTeamSearch(); }
  if (view === 'projector') app.innerHTML = projectorWelcome(null);
  app.querySelector('form')?.addEventListener('submit', async e => {
    e.preventDefault(); notice.textContent = '';
    const submit = e.target.querySelector('[type=submit], button');
    if (submit.disabled) return;
    submit.disabled = true;
    try { const values = Object.fromEntries(new FormData(e.target)); if (!values.teamId) delete values.teamId; const result = await api('/auth/' + (view === 'presenter' ? 'presenter' : 'join'), values); sessionId = result.sessionId; await connect(); }
    catch (error) { notice.textContent = error.message; }
    finally { submit.disabled = false; }
  });
}
function activity(s) { return workshopActivity(s, { draft, online, busy }); }
function iterationLabel(s) { return (s.iteration ?? 1) > 1 && [LOOP_TO, LOOP_FROM].includes(s.activePhase) ? ` · Iteración ${s.iteration}/${MAX_ITERATIONS}` : ''; }
function participantRoleBadge(role) {
  const roles = { Product:'product', 'Tech Lead':'techlead', 'AI Developer':'aideveloper', QA:'qa', Security:'security', DevOps:'devops' };
  const key = roles[role];
  return key ? `<span class="student-role-avatar role-${key}" aria-hidden="true">${icon(key)}</span>` : `<span class="student-avatar" aria-hidden="true">${icon('person')}</span>`;
}
function participantScreen(s, workshop) {
  const phase = PHASES.find(p=>p.id===s.activePhase);
  const surveyOpen = s.status === 'FINISHED';
  const status = s.status === 'WAITING' ? WAITING_MESSAGE : s.status === 'PAUSED' ? 'Sesión en pausa' : s.status === 'FINISHED' ? 'Taller finalizado' : `Fase ${phase.id}/${PHASES.length} · ${phase.title}${iterationLabel(s)} · ${STAGE_LABELS[s.phaseStage] ?? ''}`;
  if (participantTab === 'workshop') return `<div class="student-page-title"><button class="student-back" data-go="activities" aria-label="Volver a Actividades">${icon('back')}</button><h1>Taller</h1></div>${workshop}`;
  if (participantTab === 'notes') return `<div class="student-page-title"><button class="student-back" data-go="activities" aria-label="Volver a Actividades">${icon('back')}</button><h1>Notas del evento</h1></div><p>Apuntes personales. No se comparten con tu equipo ni en proyección.</p><form id="notes-form" class="card"><label for="event-notes">Mis apuntes</label><textarea id="event-notes" name="eventNotes" maxlength="3000" placeholder="Ideas que quiero recordar, preguntas, aprendizajes…">${esc(notesDraft ?? s.note?.content ?? '')}</textarea><p class="muted">Hasta 3000 caracteres · ${s.note?.updatedAt ? 'Notas guardadas en tu sesión.' : 'Pulsa Guardar para conservar tus apuntes.'}</p>${['PAUSED','FINISHED'].includes(s.status) ? '<p>Sesión en pausa o finalizada: notas en modo lectura.</p>' : ''}<button type="submit" ${savingNotes || !online || ['PAUSED','FINISHED'].includes(s.status) ? 'disabled' : ''}>Guardar notas</button></form>`;
  if (participantTab === 'activities') return `<div class="student-page-title"><h1>Actividades</h1></div>
    <section class="student-greeting">${participantRoleBadge(s.profile?.teamRole)}<div><h2>¡Hola, ${esc(s.profile?.fullName || s.team.name)}!</h2><p class="student-role-label">Mi rol: <strong>${esc(s.profile?.teamRole ?? 'Pendiente')}</strong></p><p>Vive una experiencia práctica e interactiva.</p></div></section>
    <p class="student-session-state" role="status">${esc(status)}</p>
    <div class="activity-tiles">
      <button class="activity-tile" data-go="workshop"><span class="tile-icon tile-rocket">${icon('rocket')}</span><strong>Taller</strong><span>Misión de la fase y entregas de tu equipo.</span></button>
      <button class="activity-tile" data-go="notes"><span class="tile-icon tile-notes">${icon('notes')}</span><strong>Notas del evento</strong><span>Guarda tus ideas, dudas y aprendizajes del taller.</span></button>
      <button class="activity-tile" data-go="questions"><span class="tile-icon tile-chat">${icon('chat')}</span><strong>Preguntas en vivo</strong><span>Comparte tus dudas.</span><small>Próximamente</small></button>
      <button class="activity-tile" ${surveyOpen ? 'data-go="survey"' : 'disabled'}><span class="tile-icon tile-chart">${icon('chart')}</span><strong>Encuesta</strong><span>Comparte tu experiencia.</span>${surveyOpen ? '' : '<small>Disponible al final de la presentación</small>'}</button>
    </div><p class="student-page-note">Seis fases AI-DSE, un mismo equipo. El conferencista habilita cada actividad.</p>`;
  if (participantTab === 'home') return `<h1>Tu experiencia con IA</h1><section class="card"><h2>${esc(status)}</h2><p>${esc(phase?.mission ?? 'Prepara tu equipo. Las actividades se habilitan durante la explicación.')}</p><p>${esc(s.team.name)} · ${s.team.memberCount}/${s.team.maxMembers} integrantes</p><button data-go="activities">Ver actividades</button><button class="secondary" data-go="workshop">Ir al taller</button></section>`;
  if (participantTab === 'questions') return `<div class="student-page-title"><button class="student-back" data-go="activities" aria-label="Volver a Actividades">${icon('back')}</button><h1>Preguntas en vivo</h1></div><section class="card"><h2>Próximamente</h2><p>Aquí podrás compartir tus dudas con el conferencista durante la presentación.</p></section>`;
  if (participantTab === 'survey') return `<div class="student-page-title"><button class="student-back" data-go="activities" aria-label="Volver a Actividades">${icon('back')}</button><h1>Encuesta de satisfacción</h1></div><section class="card survey-card">${surveyOpen ? `<h2>Comparte tu experiencia</h2><p>Escanea el código QR o abre el enlace para responder la encuesta.</p><div class="survey-qr">${SURVEY_QR ? `<img src="${esc(SURVEY_QR)}" alt="Código QR de la encuesta de satisfacción" width="240" height="240">` : '<p class="muted">Código QR pendiente</p>'}</div><p class="survey-link">${SURVEY_URL ? `<a href="${esc(SURVEY_URL)}" target="_blank" rel="noopener">${esc(SURVEY_URL)}</a>` : '<span class="muted">Enlace pendiente</span>'}</p>` : '<h2>Disponible al final de la presentación</h2><p>El conferencista habilitará la encuesta al cerrar la presentación.</p>'}</section>`;
  return `<h1>Mi perfil</h1><section class="card"><h2>${esc(s.profile?.fullName || s.team.name)}</h2><p>${esc(s.profile?.email ?? '')}</p><p>Mi rol: <strong>${esc(s.profile?.teamRole ?? 'Pendiente')}</strong></p><p>Equipo: ${esc(s.team.name)}</p><p>${s.team.memberCount}/${s.team.maxMembers} integrantes</p><p>${esc(s.title)}</p><p>Conserva este navegador para recuperar tu acceso. El progreso pertenece al equipo.</p><button class="secondary" id="logout">Cerrar acceso</button></section>`;
}
function render(s) {
  if (view === 'participant') document.body.dataset.screen = 'activity';
  const focused = document.activeElement;
  const focusState = focused?.name ? { name: focused.name, start: focused.selectionStart, end: focused.selectionEnd } : null;
  if (current && (current.activePhase !== s.activePhase || current.iteration !== s.iteration)) { draft = {}; pending = null; speakerPhase = null; }
  current = s; offset = s.serverTime - Date.now();
  const phase = PHASES.find(p => p.id === s.activePhase);
  app.innerHTML = `<p class="muted">${esc(s.title)}</p><h1>${s.status === 'WAITING' ? WAITING_MESSAGE : s.status === 'FINISHED' ? 'Taller finalizado' : s.status === 'PAUSED' ? 'Sesión en pausa' : `Fase ${phase.id}/${PHASES.length} · ${phase.title}${iterationLabel(s)}`}</h1><p>${s.status === 'WAITING' ? 'Prepara tu equipo. Las actividades se habilitan durante la explicación.' : esc(phase?.mission ?? '')}</p>${s.phaseStage==='PRACTICE'&&['ACTIVE','PAUSED'].includes(s.status) ? '<div id="timer" aria-label="Tiempo restante"></div>' : s.activePhase&&s.status!=='FINISHED' ? `<p class="phase-moment">${STAGE_LABELS[s.phaseStage]}${s.phaseStage==='THEORY'?' · La práctica se habilitará al terminar.':''}</p>` : ''}<div class="grid">${PHASES.map(p => `<div class="phase ${p.id === s.activePhase ? 'active' : ''}">${p.id}. ${esc(p.title)}<br><small>${p.id === s.activePhase ? `Fase actual · ${STAGE_LABELS[s.phaseStage] ?? ''}` : s.activePhase && p.id < s.activePhase ? 'Solo lectura' : 'Pendiente'}</small></div>`).join('')}</div>${view === 'presenter' ? '' : view === 'participant' ? activity(s) : s.phaseStage==='THEORY'&&['ACTIVE','PAUSED'].includes(s.status) ? '<section class="card"><h2>Primero, la explicación</h2><p>Escucha los conceptos y ejemplos. Después realizaremos la actividad práctica de esta fase.</p></section>' : `<section class="card"><h2>Progreso real de la sala</h2><p>${s.summary.completed} de ${s.summary.total} equipos completaron la fase actual.</p><p>Generación y auditoría: simulación educativa.</p></section>`}`;
  if (view === 'presenter') { document.body.dataset.screen = 'studio'; app.innerHTML = studioScreen(s); }
  if (view === 'projector') app.innerHTML = projectorScreen(s);
  if (view === 'participant') {
    app.innerHTML = participantScreen(s, app.innerHTML);
    document.dispatchEvent(new CustomEvent('participant:screen',{detail:participantTab}));
  }
  if(view==='projector'&&s.incidentShare?.visible)app.innerHTML=`<div class="projection-review-background" inert aria-hidden="true">${app.innerHTML}</div><div class="projection-review-overlay"><div class="projection-review-modal incident-share" role="dialog" aria-modal="true" aria-label="Incidente en discusión">${incidentShareContent(s.incidentShare)}</div></div>`;
  else if(view==='projector'&&s.teamReview?.visible)app.innerHTML=`<div class="projection-review-background" inert aria-hidden="true">${app.innerHTML}</div><div class="projection-review-overlay"><div class="projection-review-modal" role="dialog" aria-modal="true" aria-label="Revisión del trabajo del equipo">${reviewContent(s.teamReview)}</div></div>`;
  tick(); bind();
  if (focusState) {
    const field = app.querySelector(`[name="${focusState.name}"]`);
    if (field && !field.disabled) { field.focus(); if (typeof field.setSelectionRange === 'function' && focusState.start !== null) field.setSelectionRange(focusState.start, focusState.end); }
  }
}
function reviewContent(review){
  return `<section class="team-review-display" aria-label="Trabajo del equipo en revisión"><p class="muted">Tiene la palabra · Fase ${review.phase}: ${esc(review.title)}</p><h1>${esc(review.teamName)}</h1><p>${review.memberCount} integrantes</p><div class="team-review-text">${esc(review.pages[review.page])}</div>${review.pages.length>1?`<p class="muted">${review.page+1} / ${review.pages.length}</p>`:''}</section>`;
}
function reviewControls(s){
  const review=s.teamReview;
  return `<section class="card"><h2>Dar la palabra a un equipo</h2><p>Proyecta su entrega de la fase actual para revisarla con el grupo.</p>${review?.visible?`<p role="status">En pantalla: <strong>${esc(review.teamName)}</strong> · Fase ${review.phase}</p><button data-review-action="HIDE" ${reviewBusy||!online?'disabled':''}>Volver al taller</button>${review.pages.length>1?`<button class="secondary" data-review-page="${review.page-1}" ${reviewBusy||!online||review.page===0?'disabled':''}>Anterior</button><span>${review.page+1} / ${review.pages.length}</span><button class="secondary" data-review-page="${review.page+1}" ${reviewBusy||!online||review.page===review.pages.length-1?'disabled':''}>Siguiente</button>`:''}<details><summary>Ver lo que se está proyectando</summary>${reviewContent(review)}</details>`:'<p class="muted">El proyector muestra la vista del taller.</p>'}${s.teams.map(team=>`<div class="team-review-option"><div><strong>${esc(team.name)}</strong><p class="muted">${team.memberCount} integrantes · ${team.completed.includes(s.activePhase)?'Entrega enviada':'Sin entrega en esta fase'}</p></div><button class="secondary" data-review-team="${esc(team.id)}" ${reviewBusy||!online||!['ACTIVE','PAUSED'].includes(s.status)||s.phaseStage==='THEORY'||!team.completed.includes(s.activePhase)?'disabled':''}>${review?.visible&&review.teamId===team.id?'Actualizar en pantalla':'Dar la palabra y proyectar'}</button></div>`).join('')||'<p>Aún no hay equipos registrados.</p>'}</section>`;
}
function speakerNotes(s) {
  const phase=speakerPhase??s.activePhase??1;
  const saved=s.phaseNotes?.[phase];
  const text=speakerDrafts[phase]?.content??saved?.content??'';
  return `<section class="card speaker-notes"><h2>Fase ${phase}: ${esc(PHASES[phase-1].title)}${phase===s.activePhase?' <span class="badge">Fase actual</span>':''}</h2><form id="speaker-notes-form"><label>Ver notas de otra fase<select id="speaker-phase" name="speakerPhase">${PHASES.map(p=>`<option value="${p.id}" ${p.id===phase?'selected':''}>${p.id}. ${esc(p.title)}${p.id===s.activePhase?' · actual':''}</option>`).join('')}</select></label>${phase!==s.activePhase&&s.activePhase?'<button type="button" class="secondary" id="speaker-current">Volver a la fase actual</button>':''}<label>Puntos clave<textarea id="speaker-notes" name="speakerNotes" maxlength="6000" placeholder="Conceptos, ejemplos y preguntas que quieres recordar…">${esc(text)}</textarea></label><p class="muted">Solo visibles en Studio · ${speakerDrafts[phase]?'Cambios sin guardar':saved?'Notas guardadas':'Prepara tus apuntes para esta fase'}</p><button type="submit" ${savingSpeakerNotes||!online?'disabled':''}>Guardar notas</button>${speakerDrafts[phase]?'<button type="button" id="speaker-notes-reload" class="secondary">Descartar borrador</button>':''}</form></section>`;
}
const STUDIO_SECTIONS = [['control','Control de sesión','gauge'],['teams','Participantes','teams'],['incidents','Incidentes','warning'],['review','Dar la palabra','megaphone'],['notes','Notas de explicación','teacher'],['projection','Proyección','projector']];
const STATUS_LABELS = { WAITING:'En espera', ACTIVE:'En vivo', PAUSED:'En pausa', FINISHED:'Finalizado' };
const EVENT_LABELS = { 'session.started':s=>'Sesión iniciada · Fase 1', 'phase.opened':s=>s.phaseStage==='PRACTICE'&&s.activePhase===LOOP_TO&&(s.iteration??1)>1?`Iteración ${s.iteration} · Volver a Construcción`:`Teoría de la fase ${s.activePhase} abierta`, 'phase.closed':s=>'Fase anterior finalizada', 'phase.practice':s=>`Práctica habilitada · Fase ${s.activePhase}`, 'phase.reflection':s=>`Reflexión · Fase ${s.activePhase}`, 'phase.completed':s=>`Fase ${s.activePhase} cerrada`, 'incident.updated':s=>s.incidentShare?.visible?`Incidente en discusión · ${s.incidentShare.teamName}`:'Incidente actualizado', 'session.paused':()=>'Sesión en pausa', 'session.resumed':()=>'Sesión reanudada', 'session.finished':()=>'Sesión finalizada', 'timer.updated':()=>'Tiempo de fase ajustado', 'team.progress':s=>`Entrega de equipo · ${s.summary.completed}/${s.summary.total} listos`, 'presenter.notes.updated':()=>'Notas de explicación guardadas', 'team.review.updated':s=>s.teamReview?.visible?`En pantalla: ${s.teamReview.teamName}`:'Proyección vuelve al taller' };
function recordStudioEvent(type, s) {
  if (!['presenter','projector'].includes(view) || !EVENT_LABELS[type]) return;
  studioEvents = [{ time: new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:false}), text: EVENT_LABELS[type](s) }, ...studioEvents].slice(0,8);
}
function studioCommands(s) {
  const ready = online && !busy, live = ['ACTIVE','PAUSED'].includes(s.status), iteration = s.iteration ?? 1, last = s.activePhase === PHASES.length;
  const next = ['ADVANCE','Siguiente fase','advance'];
  const primary = s.status === 'WAITING' ? ['START','Iniciar','play']
    : s.status !== 'ACTIVE' ? null
    : s.phaseStage === 'THEORY' ? ['PRACTICE','Habilitar práctica','lightning']
    : s.phaseStage === 'PRACTICE' ? ['REFLECT','Abrir reflexión','chat']
    : last ? null : next;
  const tool = (action, label, iconName, on, extra = '') => `<button class="session-tool ${extra}" data-command="${action}" title="${label}" aria-label="${label}" ${on && ready ? '' : 'disabled'}>${icon(iconName)}</button>`;
  return `<div class="session-controls" role="toolbar" aria-label="Controles de la sesión">${primary ? `<button class="session-primary" data-command="${primary[0]}" ${ready ? '' : 'disabled'}>${icon(primary[2])}<span>${primary[1]}</span></button>` : ''}${s.activePhase === LOOP_FROM && live ? `<button class="session-primary session-iterate" data-command="ITERATE" title="Volver a Construcción con IA para ajustar el prompt y verificar de nuevo" ${ready && iteration < MAX_ITERATIONS ? '' : 'disabled'}>${icon('iterate')}<span>${iteration < MAX_ITERATIONS ? `Nueva iteración ${iteration+1}/${MAX_ITERATIONS}` : 'Iteraciones completas'}</span></button>` : ''}${s.status === 'PAUSED' ? tool('RESUME','Reanudar','play',true) : tool('PAUSE','Pausar todo','pause',s.status === 'ACTIVE')}${tool('EXTEND','Extender 5 minutos','extend',live && s.phaseStage === 'PRACTICE')}${tool('CLOSE','Cerrar fase (solo lectura)','check',s.status === 'ACTIVE' && s.phaseStage === 'REFLECTION')}${s.status === 'ACTIVE' && s.phaseStage === 'PRACTICE' && !last ? tool('ADVANCE','Saltar a la siguiente fase','advance',true) : ''}${tool('REOPEN','Retroceder / reabrir una fase','back',live)}${tool('FINISH','Finalizar sesión','finish',s.status !== 'FINISHED','danger')}</div>`;
}
function studioControl(s, phase) {
  const practice = s.phaseStage === 'PRACTICE' && ['ACTIVE','PAUSED'].includes(s.status);
  const iteration = s.iteration ?? 1;
  const stage = s.status === 'WAITING' ? 'Esperando inicio' : s.status === 'FINISHED' ? 'Taller finalizado' : ({ THEORY: 'Teoría en curso', PRACTICE: 'Práctica en curso', REFLECTION: 'Reflexión en curso', CLOSED: 'Fase cerrada' })[s.phaseStage];
  const steps = PHASES.map(p => {
    const state = s.status === 'FINISHED' || (s.activePhase && p.id < s.activePhase) ? 'done' : p.id === s.activePhase ? 'active' : '';
    return `<li class="${state}" ${state==='active'?'aria-current="step"':''}><span class="step-dot">${state==='done'?icon('check'):p.id}</span><span class="step-label">${esc(p.title)}</span></li>`;
  }).join('');
  return `<div class="studio-grid studio-hero">
    <section class="studio-panel phase-panel"><p class="panel-label">Fase actual</p><div class="phase-current"><span class="phase-ring">${phase?.id ?? '–'}</span><div><h2>${phase ? esc(phase.title) : 'Sin iniciar'}</h2><p>${stage}${iterationLabel(s)}</p></div></div>${phase?`<p class="phase-mission">${esc(phase.mission)}</p>`:''}</section>
    <section class="studio-panel timer-panel"><p class="panel-label">Tiempo de fase</p>${practice?'<div id="timer" aria-label="Tiempo restante"></div>':`<p class="timer-idle">${phase&&s.status!=='FINISHED'?`Sin cronómetro en ${STAGE_LABELS[s.phaseStage].toLowerCase()}`:'--:--'}</p>`}<p class="muted">${s.summary.completed}/${s.summary.total} equipos listos en esta fase</p></section>
  </div>
  <section class="studio-panel phase-track" aria-label="Fases del taller"><ol class="phase-stepper">${steps}</ol><p class="improvement-loop ${[LOOP_TO,LOOP_FROM].includes(s.activePhase)?'is-active':''}">${icon('iterate')}<span>Ciclo de mejora · Construcción ↔ Verificación · Iteración ${iteration}/${MAX_ITERATIONS}</span></p></section>
  <div class="studio-grid studio-stats">
    <section class="studio-panel stat-panel"><p class="panel-label">Participantes en vivo</p><p class="stat-value">${icon('teams')}<strong>${s.summary.online ?? 0}</strong></p><p class="muted">conectados de ${s.summary.participants} registrados</p></section>
    <section class="studio-panel stat-panel"><p class="panel-label">Equipos listos</p><p class="stat-value">${icon('check')}<strong>${s.summary.completed}/${s.summary.total}</strong></p><p class="muted">${phase ? `en ${esc(phase.title)}` : 'en la fase actual'}</p></section>
    <section class="studio-panel events-panel"><p class="panel-label">Eventos recientes</p>${studioEvents.length?`<ul class="event-list">${studioEvents.map(e=>`<li><time>${e.time}</time><span>${esc(e.text)}</span></li>`).join('')}</ul>`:'<p class="muted">Los eventos aparecerán aquí durante la sesión.</p>'}</section>
  </div>`;
}
function studioTeams(s) {
  const phase = PHASES.find(p => p.id === s.activePhase);
  const done = t => Boolean(phase && t.completed.includes(phase.id));
  const teams = [...s.teams].sort((a, b) => done(a) - done(b));
  return `<section class="studio-panel"><p class="panel-label">${phase ? `Fase ${phase.id} · ${esc(phase.title)}${iterationLabel(s)}` : 'Sesión sin iniciar'}</p><p>${phase ? `<strong>${s.summary.completed}/${s.summary.total}</strong> equipos entregaron en esta fase` : `${s.teams.length} equipos registrados`} · ${s.summary.participants} participantes · Código estadístico: <strong>${esc(s.statisticsCode)}</strong></p></section>
  <div class="team-grid">${teams.map(t => `<section class="studio-panel team-panel ${done(t)?'is-done':''}"><div class="team-head"><h2>${esc(t.name)}</h2><span class="badge team-members" title="Integrantes">${icon('teams')}${t.memberCount}/${t.maxMembers}</span><button class="admin-remove" data-remove-team="${esc(t.id)}" data-name="${esc(t.name)}" data-count="${t.memberCount}" title="Eliminar equipo" aria-label="Eliminar equipo ${esc(t.name)}" ${adminBusy||!online?'disabled':''}>${icon('trash')}</button></div>${phase?`<p class="team-phase-status">${done(t)?`${icon('check')}<span>${DELIVERABLE_STATUS[t.current?.status]} · ${esc(phase.title)}</span>`:`<span>${t.current?.status?DELIVERABLE_STATUS[t.current.status]:'Pendiente'} · ${esc(phase.title)}</span>`}</p>${t.current?.text?`<details class="team-deliverable"><summary>Ver entrega</summary><pre>${esc(t.current.text)}</pre>${t.current.review?.comment?`<p class="muted">Comentario: ${esc(t.current.review.comment)}</p>`:''}${['submitted','accepted','needs_review'].includes(t.current.status)?`<div class="actions"><button class="secondary" data-deliverable-review="ACCEPT" data-team="${esc(t.id)}" ${t.current.status==='accepted'||adminBusy||!online?'disabled':''}>Aceptar</button><button class="secondary" data-deliverable-review="REQUEST_CHANGES" data-team="${esc(t.id)}" ${t.current.status==='needs_review'||adminBusy||!online?'disabled':''}>Pedir revisión</button></div>`:''}</details>`:''}${t.legacy?'<p class="muted">Trabajo del modelo anterior pendiente de reconciliación.</p>':''}`:''}<ol class="team-progress" aria-label="Entregas por fase">${PHASES.map(p=>`<li class="${t.completed.includes(p.id)?'done':''} ${p.id===s.activePhase?'current':''}" title="${p.id}. ${esc(p.title)} · ${t.completed.includes(p.id)?'Entregada':'Pendiente'}">${p.id}</li>`).join('')}</ol><details><summary>Integrantes y roles</summary><ul class="member-list">${t.members.map(member=>`<li><div class="member-info"><strong>${esc(member.fullName || 'Pendiente de completar registro')}</strong><span>${esc(member.teamRole ?? 'Rol pendiente')}</span><small>${esc(member.email ?? '')}</small></div><button class="admin-remove" data-remove-member="${esc(member.id)}" data-name="${esc(member.fullName || 'Integrante sin registro completo')}" data-team="${esc(t.name)}" title="Quitar integrante" aria-label="Quitar a ${esc(member.fullName || 'integrante')} del equipo" ${adminBusy||!online?'disabled':''}>${icon('trash')}</button></li>`).join('')}</ul></details></section>`).join('') || '<section class="studio-panel"><p>Aún no hay equipos registrados.</p></section>'}</div>`;
}
// Bienvenida del auditorio antes de iniciar: registro guiado con QR a la URL de producción.
function projectorWelcome(s) {
  const host = PRODUCTION_URL.replace(/^https?:\/\//, '');
  const schedule = s ? `${esc(s.title)} · ${s.id === 'tarde' ? '2:00–4:00 p. m.' : '6:00–8:00 p. m.'}` : '18 de noviembre de 2026 · Extensión Chía';
  const steps = [['qrline', 'Escanea el código o entra a', esc(host)], ['person', 'Escribe tu nombre completo', 'y <strong>tu correo</strong>'], ['teams', 'Únete a tu equipo o créalo:', '<strong>máximo seis integrantes</strong>'], ['monitor', 'Elige tu sesión y espera', '<strong>la señal del conferencista</strong>']];
  return `<div class="pw-screen">
  <section class="pw-intro">
    <p class="pw-eyebrow">${icon('live')}<span>${schedule}</span></p>
    <h1><span class="pw-hello">Bienvenidos a</span><span class="pw-title">Crea tu primera <span class="pw-highlight">APP con IA<svg class="pw-swoosh" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path d="M4 18 C 70 8, 170 4, 296 9" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg></span></span></h1>
    <p class="pw-lead">Un taller práctico para descubrir, especificar, construir con IA simulada<br>y verificar una app en equipo, con el modelo AI-DSE.</p>
    <ol class="pw-steps">${steps.map(([iconName, first, second], i) => `<li><span class="pw-step-number">${i + 1}</span><span class="pw-step-icon">${icon(iconName)}</span><span class="pw-step-text">${first}<br>${i === 0 ? `<strong>${second}</strong>` : second}</span><span class="pw-step-caret">${icon('caret')}</span></li>`).join('')}</ol>
  </section>
  <aside class="pw-access" aria-label="Acceso para participantes">
    <p class="pw-access-title">Regístrate desde tu celular</p>
    <div class="pw-qr">${productionQr(`Código QR para abrir ${host}`)}</div>
    <p class="pw-url">${esc(host)}</p>
    <p class="pw-caption">Abre la cámara y apunta al código</p>
  </aside>
  ${s ? `<div class="pw-live"><span>${icon('teams')}<strong>${s.summary.participants}</strong> registrados</span><span>${icon('activities')}<strong>${s.summary.total}</strong> equipos</span><span>${icon('live')}<strong>${s.summary.online ?? 0}</strong> conectados ahora</span><span class="pw-wait">En un momento daremos inicio al taller</span></div>` : ''}
</div>`;
}
function projectorScreen(s) {
  if (s.status === 'WAITING') return projectorWelcome(s);
  const phase = PHASES.find(p => p.id === s.activePhase);
  const theory = s.phaseStage === 'THEORY' && ['ACTIVE','PAUSED'].includes(s.status);
  const title = s.status === 'WAITING' ? 'Bienvenidos' : s.status === 'FINISHED' ? 'Taller finalizado' : esc(phase.title);
  const subtitle = s.status === 'WAITING' ? 'En un momento daremos inicio al taller' : s.status === 'FINISHED' ? 'Gracias por crear con nosotros' : `${s.status === 'PAUSED' ? 'Sesión en pausa' : ({ THEORY: 'Teoría', PRACTICE: 'Práctica en equipo', REFLECTION: 'Reflexión: compartimos hallazgos', CLOSED: 'Fase cerrada' })[s.phaseStage]}${iterationLabel(s)}`;
  const mission = s.status === 'WAITING' ? 'Forma tu equipo de hasta seis integrantes e ingresa desde tu celular con el mismo nombre de equipo.'
    : s.status === 'FINISHED' ? 'Comparte tu experiencia en la encuesta de satisfacción desde la sección Actividades.'
    : theory ? `Escucha la explicación. Después: ${esc(phase.mission)}` : s.phaseStage === 'REFLECTION' ? `Compartan lo aprendido. Evidencia: ${esc(phase.deliverable)}` : esc(phase.mission);
  const timer = s.status === 'WAITING' ? '<p class="pj-timer-text">Por iniciar</p>' : s.status === 'FINISHED' ? '<p class="pj-timer-text">Completado</p>' : s.phaseStage !== 'PRACTICE' ? `<p class="pj-timer-text">${STAGE_LABELS[s.phaseStage]}</p>` : '<div id="timer" aria-label="Tiempo restante"></div>';
  const steps = PHASES.map(p => {
    const state = s.status === 'FINISHED' || (s.activePhase && p.id < s.activePhase) ? 'done' : p.id === s.activePhase ? 'active' : '';
    return `<li class="${state}"><span class="pj-step-dot">${state === 'done' ? icon('check') : p.id}</span><span>${esc(p.title)}</span></li>`;
  }).join('');
  const board = s.leaderboard ?? [];
  const ranking = board.length ? `<ol class="pj-ranking-list">${board.slice(0,5).map((team, index) => `<li><span class="pj-position pos-${index+1}">${index+1}</span><span class="pj-team">${esc(team.name)}</span><span class="pj-bar" role="img" aria-label="${team.completed} de ${PHASES.length} fases entregadas">${PHASES.map(p => `<i class="${p.id <= team.completed ? 'is-filled' : ''}"></i>`).join('')}</span><strong>${team.completed}/${PHASES.length}</strong></li>`).join('')}</ol>${board.length > 5 ? `<p class="pj-more">y ${board.length-5} equipos más</p>` : ''}` : '<p class="pj-empty">Los equipos aparecerán aquí al registrarse.</p>';
  return `<div class="pj-screen">
  <div class="pj-top">
    <section class="pj-card pj-phase"><span class="pj-ring">${phase && s.status !== 'FINISHED' ? phase.id : icon(s.status === 'FINISHED' ? 'trophy' : 'workshop')}</span><div><p class="pj-label">${phase && s.status !== 'FINISHED' ? `Fase actual · ${phase.id} de ${PHASES.length}` : esc(s.title)}</p><h1>${title}</h1><p class="pj-sub">${subtitle}</p></div></section>
    <section class="pj-card pj-timer ${s.status === 'PAUSED' ? 'is-paused' : ''}"><p class="pj-label">${icon('hourglass')}${s.status === 'PAUSED' ? 'En pausa' : s.status === 'WAITING' ? 'Inicio del taller' : s.status === 'FINISHED' ? 'Estado' : s.phaseStage !== 'PRACTICE' ? 'Momento actual' : 'Tiempo restante'}</p>${timer}</section>
  </div>
  <div class="pj-middle">
    <ol class="pj-card pj-steps" aria-label="Fases del taller">${steps}</ol>
    <section class="pj-card pj-stat"><p class="pj-label">Conectados</p><p class="pj-stat-value">${icon('teams')}<strong>${s.summary.online ?? 0}</strong></p><p class="pj-stat-sub">de ${s.summary.participants} registrados</p></section>
    <section class="pj-card pj-stat"><p class="pj-label">Equipos listos</p><p class="pj-stat-value">${icon('check')}<strong>${s.summary.completed}/${s.summary.total}</strong></p><p class="pj-stat-sub">${phase && s.status !== 'FINISHED' ? `en ${esc(phase.title)}` : `${s.summary.total} equipos registrados`}</p></section>
  </div>
  <div class="pj-bottom">
    <section class="pj-card pj-mission"><span class="pj-icon">${icon('target')}</span><div><h2>${s.status === 'WAITING' ? 'Para empezar' : s.status === 'FINISHED' ? 'Antes de salir' : 'Misión de la fase'}</h2><p>${mission}</p></div></section>
    <section class="pj-card pj-ranking"><h2>${icon('ranking')}Avance de equipos</h2>${ranking}</section>
    <section class="pj-card pj-events"><h2>Últimos eventos</h2>${studioEvents.length ? `<ul>${studioEvents.slice(0,5).map(e => `<li><time>${e.time}</time><span>${esc(e.text)}</span></li>`).join('')}</ul>` : `<p class="pj-empty">${s.summary.completed} de ${s.summary.total} equipos completaron la fase actual.</p>`}</section>
  </div>
</div>`;
}
const INCIDENT_LABELS = { assigned: 'Asignado', revealed: 'Revelado', acknowledged: 'Respondido', resolved: 'Resuelto', discussed: 'Discutido' };
function incidentShareContent(share) {
  return `<section class="incident-display"><p class="incident-display-eyebrow">${icon('warning')}<span>Incidente en discusión · Fase ${share.phase} · ${esc(share.category)} · ${esc(share.severity)}</span></p><h1>${esc(share.title)}</h1><p class="incident-display-team">Comparte: <strong>${esc(share.teamName)}</strong></p><p class="incident-display-text">${esc(share.genericDescription)}</p><p class="incident-display-question">${esc(share.discussionQuestion)}</p>${share.learningPoint ? `<div class="incident-display-learning"><strong>Aprendizaje: ${esc(share.learningPoint)}</strong><span>Se pudo prevenir o detectar en: ${esc(share.preventedIn.join(', '))}</span></div>` : ''}</section>`;
}
function studioIncidents(s) {
  const data = s.incidents ?? { assignments: [], catalog: [], share: { visible: false, version: 0 } };
  const share = data.share;
  const shared = share.visible ? data.assignments.find(a => a.teamId === share.teamId && a.code === share.code) : null;
  const current = data.assignments.filter(a => a.phase === s.activePhase);
  const others = data.assignments.filter(a => a.phase !== s.activePhase);
  const disabled = adminBusy || !online ? 'disabled' : '';
  const row = a => `<li class="incident-row severity-${esc(a.severity.toLowerCase())}"><div class="incident-row-head"><span class="incident-code">${esc(a.code)}</span><strong>${esc(a.title)}</strong><span class="badge">${esc(a.severity)}</span><span class="incident-status status-${a.status}">${INCIDENT_LABELS[a.status]}</span></div>
    <p class="muted">${esc(a.teamName)} · Fase ${a.phase} · ${a.origin === 'manual' ? 'Asignación manual' : 'Asignación automática'}</p>
    <details><summary>Detalle docente${a.response ? ' y respuesta del equipo' : ''}</summary><p>${esc(a.privateDescription)}</p>${a.response ? `<p><strong>Decisión del equipo:</strong> ${esc(a.choices.find(c => c.id === a.response.choice)?.text ?? '')}<br>${esc(a.response.justification)}</p>` : '<p class="muted">Sin respuesta todavía.</p>'}<p><strong>Esperado:</strong> ${esc(a.choices.find(c => c.id === a.feedback.expectedChoice)?.text ?? '')}. ${esc(a.feedback.expectedReasoning)}</p><p><strong>Aprendizaje:</strong> ${esc(a.feedback.learningPoint)} · Se previene en: ${esc(a.feedback.preventedIn.join(', '))}</p></details>
    <div class="actions">${a.status === 'assigned' ? `<button class="secondary" data-incident-action="REVEAL" data-team="${esc(a.teamId)}" data-code="${esc(a.code)}" ${a.phase === s.activePhase ? disabled : 'disabled'}>Revelar al equipo</button>` : ''}${a.status === 'revealed' ? `<button class="secondary" data-incident-action="HIDE" data-team="${esc(a.teamId)}" data-code="${esc(a.code)}" ${disabled}>Ocultar</button>` : ''}${['revealed','acknowledged'].includes(a.status) ? `<button class="secondary" data-incident-action="RESOLVE" data-team="${esc(a.teamId)}" data-code="${esc(a.code)}" ${disabled}>Marcar resuelto</button>` : ''}${a.status !== 'assigned' && a.phase === s.activePhase && !(share.visible && share.teamId === a.teamId && share.code === a.code) ? `<button data-incident-action="SHARE" data-team="${esc(a.teamId)}" data-code="${esc(a.code)}" ${disabled}>${icon('projector')}<span>Compartir con auditorio</span></button>` : ''}<button class="admin-remove" title="Quitar asignación" aria-label="Quitar ${esc(a.code)} de ${esc(a.teamName)}" data-incident-action="UNASSIGN" data-team="${esc(a.teamId)}" data-code="${esc(a.code)}" ${disabled}>${icon('trash')}</button></div></li>`;
  return `${shared ? `<section class="studio-panel incident-live"><p class="panel-label">En el auditorio</p><h2>${esc(shared.code)} · ${esc(shared.title)}</h2><p>Comparte <strong>${esc(shared.teamName)}</strong>. Pregunta: ${esc(shared.discussionQuestion)}</p><div class="actions">${share.learning ? '' : `<button class="secondary" data-incident-share="LEARNING" ${disabled}>Mostrar aprendizaje</button>`}<button data-incident-share="END_SHARE" ${disabled}>Finalizar discusión</button></div></section>` : ''}
  <section class="studio-panel"><p class="panel-label">${s.activePhase ? `Fase ${s.activePhase} · ${esc(PHASES[s.activePhase - 1].title)}` : 'Sesión sin iniciar'}</p><p>Los incidentes se asignan de forma determinista al habilitar la práctica (máximo 2 por equipo y 1 crítico). Puedes revelarlos, anularlos o asignarlos manualmente.</p>
    ${s.activePhase && data.catalog.length && s.teams.length ? `<form id="incident-assign" class="incident-assign"><label>Equipo<select name="teamId">${s.teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><label>Incidente<select name="code">${data.catalog.map(c => `<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.title)} (${esc(c.severity)})</option>`).join('')}</select></label><button type="submit" class="secondary" ${disabled}>Asignar</button></form>` : ''}</section>
  <section class="studio-panel"><p class="panel-label">Incidentes de esta fase</p>${current.length ? `<ul class="incident-list">${current.map(row).join('')}</ul>` : '<p class="muted">Sin incidentes asignados en esta fase.</p>'}</section>
  ${others.length ? `<section class="studio-panel"><details><summary>Otras fases (${others.length})</summary><ul class="incident-list">${others.map(row).join('')}</ul></details></section>` : ''}`;
}
function studioProjection(s) {
  return `<section class="studio-panel"><p class="panel-label">Pantalla de auditorio</p><h2>Proyección 16:9</h2><p>Abre la vista del auditorio en otra pestaña o pantalla. No muestra datos privados de los equipos.</p><p>${s.teamReview?.visible?`En pantalla: <strong>${esc(s.teamReview.teamName)}</strong> · Fase ${s.teamReview.phase}`:'En pantalla: vista general del taller.'}</p><button id="projector">${icon('projector')}<span>Abrir proyección 16:9</span></button><p id="projector-link"></p></section>`;
}
function studioScreen(s) {
  const phase = PHASES.find(p => p.id === s.activePhase);
  const section = STUDIO_SECTIONS.find(([id]) => id === studioTab) ?? STUDIO_SECTIONS[0];
  const body = { control: () => studioControl(s, phase), teams: () => studioTeams(s), incidents: () => studioIncidents(s), review: () => reviewControls(s), notes: () => speakerNotes(s), projection: () => studioProjection(s) }[section[0]]();
  return `<div class="studio-shell ${studioCollapsed?'is-collapsed':''} ${studioMenuOpen?'menu-open':''}">
  <aside class="studio-sidebar" id="studio-sidebar" aria-label="Navegación de Studio">
    <button class="studio-collapse" id="studio-collapse" aria-expanded="${!studioCollapsed}" aria-controls="studio-sidebar" title="${studioCollapsed?'Expandir menú':'Contraer menú'}">${icon('sidebar')}<span>${studioCollapsed?'Expandir menú':'Contraer menú'}</span></button>
    <nav><ul>${STUDIO_SECTIONS.map(([id,label,iconName])=>`<li><button class="studio-nav-item" data-studio-tab="${id}" title="${label}" ${id===section[0]?'aria-current="page"':''}>${icon(iconName)}<span>${label}</span></button></li>`).join('')}</ul></nav>
    <div class="studio-sidebar-footer"><p class="studio-session" title="${esc(s.title)}">${icon('live')}<span>${esc(s.title)}</span></p><button class="studio-nav-item" id="logout" title="Cerrar acceso">${icon('logout')}<span>Cerrar acceso</span></button></div>
  </aside>
  <div class="studio-scrim" id="studio-scrim" aria-hidden="true"></div>
  <div class="studio-content">
    <div class="studio-topbar"><button class="studio-menu-button" id="studio-menu" aria-label="Abrir menú" aria-controls="studio-sidebar" aria-expanded="${studioMenuOpen}">${icon('menu')}</button><div class="studio-heading"><p class="muted">Control Center · ${esc(s.title)}</p><h1>${section[1]}</h1></div><div class="session-bar"><span class="studio-status status-${s.status.toLowerCase()}">${STATUS_LABELS[s.status] ?? esc(s.status)}${s.status==='ACTIVE'||s.status==='PAUSED'?` · Fase ${s.activePhase}/${PHASES.length} · ${STAGE_LABELS[s.phaseStage]}${(s.iteration??1)>1&&[LOOP_TO,LOOP_FROM].includes(s.activePhase)?` · It. ${s.iteration}`:''}`:''}</span>${['ACTIVE','PAUSED'].includes(s.status)&&s.phaseStage==='PRACTICE'?'<span class="session-timer" data-timer aria-label="Tiempo restante"></span>':''}${studioCommands(s)}</div></div>
    ${body}
  </div>
</div>`;
}
function setStudioMenu(open) {
  studioMenuOpen = open;
  document.querySelector('.studio-shell')?.classList.toggle('menu-open', open);
  document.querySelector('#studio-menu')?.setAttribute('aria-expanded', String(open));
}
function tick() {
  if (!current) return;
  const timers = document.querySelectorAll('#timer, [data-timer]'); if (!timers.length) return;
  const ms = current.status === 'PAUSED' ? current.remainingMs : current.deadline ? Math.max(0, current.deadline - Date.now() - offset) : 0;
  const seconds = Math.ceil(ms / 1000), text = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const expired = current.status === 'ACTIVE' && current.phaseStage === 'PRACTICE' && ms === 0;
  timers.forEach(timer => { timer.textContent = text; timer.classList.toggle('is-expired', expired); timer.title = expired ? 'Tiempo agotado' : ''; });
}
setInterval(tick, 1000);
async function mutate(route, payload) {
  busy = true; notice.textContent = '';
  // Reintentos de la misma acción conservan su clave incluso ante pérdida de respuesta.
  const signature = JSON.stringify({ route, version: current.version, payload });
  if (pending?.signature !== signature) pending = { signature, idempotencyKey: crypto.randomUUID() };
  try {
    const next = await api(`/sessions/${sessionId}/${route}`, { ...payload, expectedVersion: current.version, idempotencyKey: pending.idempotencyKey });
    pending = null; busy = false; render(next); notice.textContent = 'Guardado en el servidor.';
  } catch (error) {
    busy = false; notice.textContent = error.message;
    if (error.code === 'VERSION_CONFLICT' || error.code === 'PHASE_LOCKED') { pending = null; await refresh(); }
  } finally { busy = false; }
}
function bind() {
  async function changeReview(payload){
    if(reviewBusy||!online)return;reviewBusy=true;notice.textContent='';
    try{const next=await api(`/sessions/${sessionId}/team-review`,{...payload,expectedVersion:current.teamReview?.version??0});render(next);}
    catch(error){notice.textContent=error.message;if(error.code==='REVIEW_VERSION_CONFLICT')await refresh();}
    finally{reviewBusy=false;render(current);}
  }
  async function teamAdmin(payload, question) {
    if (adminBusy || !online || !confirm(question)) return;
    adminBusy = true; notice.textContent = '';
    try { const next = await api(`/sessions/${sessionId}/team-admin`, payload); render(next); notice.textContent = payload.action === 'REMOVE_TEAM' ? 'Equipo eliminado.' : 'Integrante eliminado.'; }
    catch (error) { notice.textContent = error.message; await refresh(); }
    finally { adminBusy = false; render(current); }
  }
  document.querySelectorAll('[data-remove-team]').forEach(button => button.addEventListener('click', () => teamAdmin({ action: 'REMOVE_TEAM', teamId: button.dataset.removeTeam },
    `¿Eliminar el equipo «${button.dataset.name}»?\n\nSe borrarán sus ${button.dataset.count} integrantes, sus entregas y sus notas personales, y se cerrarán sus accesos. Esta acción no se puede deshacer.`)));
  document.querySelectorAll('[data-remove-member]').forEach(button => button.addEventListener('click', () => teamAdmin({ action: 'REMOVE_MEMBER', memberId: button.dataset.removeMember },
    `¿Quitar a «${button.dataset.name}» del equipo «${button.dataset.team}»?\n\nSe cerrará su acceso y se borrarán sus notas personales. Podrá volver a ingresar como integrante nuevo. Esta acción no se puede deshacer.`)));
  document.querySelectorAll('[data-review-team]').forEach(button=>button.addEventListener('click',()=>changeReview({action:'SHOW',teamId:button.dataset.reviewTeam})));
  document.querySelector('[data-review-action]')?.addEventListener('click',()=>changeReview({action:'HIDE'}));
  document.querySelectorAll('[data-review-page]').forEach(button=>button.addEventListener('click',()=>changeReview({action:'PAGE',page:Number(button.dataset.reviewPage)})));

  const speakerInput=document.querySelector('#speaker-notes');
  document.querySelector('#speaker-phase')?.addEventListener('change',e=>{speakerPhase=Number(e.target.value);render(current);});
  speakerInput?.addEventListener('input',()=>{
    const phase=speakerPhase??current.activePhase??1;
    speakerDrafts[phase]={content:speakerInput.value,version:speakerDrafts[phase]?.version??current.phaseNotes?.[phase]?.version??0};
    document.querySelector('.speaker-notes .muted').textContent='Solo visibles en Studio · Cambios sin guardar';
  });
  document.querySelector('#speaker-current')?.addEventListener('click',()=>{speakerPhase=null;render(current);});
  document.querySelector('#speaker-notes-reload')?.addEventListener('click',()=>{delete speakerDrafts[speakerPhase??current.activePhase??1];render(current);});
  document.querySelector('#speaker-notes-form')?.addEventListener('submit',async e=>{
    e.preventDefault();if(savingSpeakerNotes||!online)return;
    const phase=speakerPhase??current.activePhase??1;
    const savedDraft=speakerDrafts[phase]??{content:speakerInput.value,version:current.phaseNotes?.[phase]?.version??0};
    savingSpeakerNotes=true;if(e.submitter)e.submitter.disabled=true;
    try{
      const {note}=await api(`/sessions/${sessionId}/phase-notes`,{phase,content:savedDraft.content,expectedVersion:savedDraft.version});
      current.phaseNotes??={};current.phaseNotes[phase]=note;
      if(speakerDrafts[phase]?.content===savedDraft.content)delete speakerDrafts[phase];
      else if(speakerDrafts[phase])speakerDrafts[phase].version=note.version;
      notice.textContent='Notas de la fase guardadas.';
    }catch(error){notice.textContent=error.message;}finally{savingSpeakerNotes=false;render(current);}
  });

  const notesForm = document.querySelector('#notes-form');
  const notesInput = document.querySelector('#event-notes');
  if (notesInput) notesInput.readOnly = ['PAUSED','FINISHED'].includes(current.status);
  notesInput?.addEventListener('input',()=>{ notesDraft = notesInput.value; });
  notesForm?.addEventListener('submit',async event=>{
    event.preventDefault(); if(savingNotes || !online) return;
    const content = notesInput.value;
    savingNotes = true; event.submitter.disabled = true; notice.textContent = '';
    try {
      const result = await api('/notes',{content,expectedVersion:current.note?.version ?? 0});
      current.note = result.note;
      if(notesDraft === content) notesDraft = undefined;
      notice.textContent = 'Notas guardadas.';
    } catch(error) { notice.textContent = error.message; }
    finally { savingNotes = false; if(participantTab === 'notes') render(current); }
  });
  document.querySelectorAll('[data-studio-tab]').forEach(button=>button.addEventListener('click',()=>{
    studioTab=button.dataset.studioTab; studioMenuOpen=false; render(current);
    document.querySelector('.studio-content')?.scrollTo({top:0});
    document.querySelector(`[data-studio-tab="${studioTab}"]`)?.focus();
  }));
  document.querySelector('#studio-collapse')?.addEventListener('click',()=>{
    studioCollapsed=!studioCollapsed;
    try{localStorage.setItem('ingenia.studio.sidebar',studioCollapsed?'collapsed':'expanded');}catch{}
    render(current); document.querySelector('#studio-collapse')?.focus();
  });
  document.querySelector('#studio-menu')?.addEventListener('click',()=>{ setStudioMenu(true); document.querySelector('[data-studio-tab][aria-current]')?.focus(); });
  document.querySelector('#studio-scrim')?.addEventListener('click',()=>setStudioMenu(false));
  document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>navigateParticipant(button.dataset.go)));
  document.querySelector('#logout')?.addEventListener('click', async () => { await api('/auth/logout', {}); stream?.close(); online = false; draft = {}; login(); });
  document.querySelector('#activity')?.addEventListener('input', e => { draft[e.target.name] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; });
  document.querySelector('#activity')?.addEventListener('submit', async e => {
    e.preventDefault(); if (busy || !online) return;
    await mutate('actions/' + e.target.dataset.action, readActivityForm(e.target, e.submitter));
  });
  document.querySelector('#generate')?.addEventListener('input', e => { draft.prompt = e.target.value; });
  document.querySelector('#generate')?.addEventListener('submit', async e => {
    e.preventDefault(); if (busy || !online) return;
    await mutate('actions/generate', { prompt: e.target.elements.prompt.value });
  });
  async function incidentCommand(payload, question) {
    if (adminBusy || !online || (question && !confirm(question))) return;
    adminBusy = true; notice.textContent = '';
    try { render(await api(`/sessions/${sessionId}/incidents`, payload)); notice.textContent = 'Incidente actualizado.'; }
    catch (error) { notice.textContent = error.message; await refresh(); }
    finally { adminBusy = false; render(current); }
  }
  document.querySelectorAll('[data-incident-action]').forEach(button => button.addEventListener('click', () => {
    const { incidentAction: action, team: teamId, code } = button.dataset;
    const question = { UNASSIGN: `¿Quitar el incidente ${code} de este equipo?`, SHARE: `¿Compartir ${code} con el auditorio? Se mostrará el nombre del equipo y una descripción genérica, sin su respuesta.` }[action];
    incidentCommand({ action, teamId, code, ...(action === 'SHARE' ? { expectedVersion: current.incidents.share.version } : {}) }, question);
  }));
  document.querySelectorAll('[data-incident-share]').forEach(button => button.addEventListener('click', () => incidentCommand({ action: button.dataset.incidentShare, expectedVersion: current.incidents.share.version })));
  document.querySelector('#incident-assign')?.addEventListener('submit', e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); incidentCommand({ action: 'ASSIGN', ...data }); });
  document.querySelectorAll('.incident-form').forEach(form => {
    form.addEventListener('input', e => { draft[`incident-${form.dataset.incident}-${e.target.name}`] = e.target.value; });
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (busy || !online) return;
      busy = true; notice.textContent = '';
      try { render(await api(`/sessions/${sessionId}/incident-response`, { code: form.dataset.incident, choice: form.elements.choice.value, justification: form.elements.justification.value })); notice.textContent = 'Respuesta del equipo registrada.'; }
      catch (error) { notice.textContent = error.message; }
      finally { busy = false; render(current); }
    });
  });
  document.querySelectorAll('[data-deliverable-review]').forEach(button => button.addEventListener('click', async () => {
    if (adminBusy || !online) return;
    const decision = button.dataset.deliverableReview;
    const comment = decision === 'REQUEST_CHANGES' ? prompt('Comentario para el equipo (opcional):') : '';
    if (comment === null) return;
    adminBusy = true; notice.textContent = '';
    try { render(await api(`/sessions/${sessionId}/deliverable-review`, { teamId: button.dataset.team, phase: current.activePhase, decision, comment: comment.slice(0, 500) })); notice.textContent = decision === 'ACCEPT' ? 'Entrega aceptada.' : 'Se pidió revisar la entrega.'; }
    catch (error) { notice.textContent = error.message; }
    finally { adminBusy = false; render(current); }
  }));
  document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', async () => {
    if (busy) return;
    const action = button.dataset.command; const payload = { action, ...(action === 'EXTEND' ? { seconds: 300 } : {}) };
    if (action === 'REOPEN') { payload.phase = Number(prompt(`Fase que deseas reabrir (1–${PHASES.length}):`)); if (!Number.isInteger(payload.phase) || payload.phase<1 || payload.phase>PHASES.length) return; }
    if (['ADVANCE','REOPEN','ITERATE','FINISH'].includes(action)) {
      if (!confirm(`${action === 'ADVANCE' ? `Iniciar la teoría de la fase ${current.activePhase+1}: ${PHASES[current.activePhase].title}.` : action === 'REOPEN' ? `Reabrir la teoría de la fase ${payload.phase}.` : action === 'ITERATE' ? `Iteración ${(current.iteration ?? 1)+1}/${MAX_ITERATIONS}: los equipos vuelven a Construcción con IA para ajustar el prompt; construcción y verificación se repiten y lo anterior queda archivado.` : 'Finalizar la sesión.'} ${current.summary.completed}/${current.summary.total} equipos listos. Las acciones de otras fases quedarán bloqueadas. ¿Confirmar?`)) return;
      payload.confirm = true;
    }
    await mutate('phase-command', payload);
  }));
  document.querySelector('#projector')?.addEventListener('click', async () => {
    const tab = window.open('about:blank', '_blank');
    if (!tab) { notice.textContent = 'Permite ventanas emergentes para abrir la proyección desde Studio.'; return; }
    tab.opener = null;
    try {
      const { token } = await api(`/sessions/${sessionId}/projector-access`, {});
      tab.location.replace(`${location.origin}/projector#${token}`);
    } catch (error) { tab.close(); notice.textContent = error.message; }
  });
  document.querySelector('#report')?.addEventListener('click', async () => {
    try { const report = await api(`/sessions/${sessionId}/report`); const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})); const a = document.createElement('a'); a.href=url; a.download='ingenia-reporte-demo.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
    catch(error) { notice.textContent=error.message; }
  });
}
async function refresh() { const s = await api(`/sessions/${sessionId}/state`); render(s); }
async function connect() {
  await refresh(); stream?.close();
  stream = new EventSource(`${({ presenter: '/api/studio', projector: '/api/projection', participant: '/api' })[view]}/sessions/${sessionId}/events`);
  stream.onopen = () => { online = true; setConnection('En vivo · Servidor conectado'); if(current) render(current); };
  const activeStream = stream;
  stream.onerror = async () => {
    if (activeStream !== stream) return;
    online = false; setConnection('Reconectando… Acciones bloqueadas'); if(current) render(current);
    try { const me = await api('/me'); if(activeStream === stream && me.sessionId !== sessionId) { activeStream.close(); login(); } }
    catch(error) {
      if(error.code === 'UNAUTHENTICATED' && activeStream === stream) { activeStream.close(); login(); notice.textContent = 'Tu acceso anterior terminó. Ingresa de nuevo para continuar.'; }
    }
  };
  for (const type of ['state','session.started','phase.closed','phase.opened','session.paused','session.resumed','session.finished','timer.updated','team.progress','phase.practice','presenter.notes.updated','team.review.updated','presence.updated','phase.reflection','phase.completed','incident.updated']) stream.addEventListener(type, e => { online = true; setConnection('En vivo · Servidor conectado'); const next = JSON.parse(e.data); recordStudioEvent(type, next); render(next); });
}
async function boot() {
  try {
    if (view === 'projector' && location.hash) { const token = location.hash.slice(1); history.replaceState(null,'',location.pathname); await api('/auth/projector',{token}); }
    const me = await api('/me');
    const expected = { participant:'PARTICIPANT', presenter:'PRESENTER', projector:'PROJECTOR' }[view];
    if (me.role !== expected) { login(); if (view !== 'participant') notice.textContent = 'Usa otro perfil o cierra el acceso actual para cambiar de rol.'; return; }
    if(view === 'participant') {
      const state = await api(`/sessions/${me.sessionId}/state`);
      if(!state.profile?.email) {
        login();
        const form=document.querySelector('#login');
        form.elements.name.value=state.team.name;
        form.elements.sessionId.value=me.sessionId;
        return;
      }
    }
    sessionId = me.sessionId; await connect();
  } catch(error) { login(); if(error.code && error.code !== 'UNAUTHENTICATED') notice.textContent = error.message; }
}
window.addEventListener('online', () => { if(sessionId) refresh().catch(()=>{}); });
boot();
