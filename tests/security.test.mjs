import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../services/api/server.mjs';
import { transition } from '../services/api/domain.mjs';
const password = 'test-only-presenter-password-123456789';
// Entregas válidas por acción; cada prueba sobreescribe solo lo que necesita.
const VALID = {
  discovery: { projectType: 'reservas', user: 'Estudiantes que organizan eventos académicos', problem: 'Las reservas se pierden en chats y hojas sueltas', features: ['Crear reserva', 'Ver mis reservas', 'Cancelar reserva'], constraint: 'Solo correo institucional' },
  specification: { stories: ['Como estudiante quiero reservar un auditorio para mi evento', 'Como estudiante quiero cancelar mi reserva para liberar el espacio'], criteria: ['La reserva aparece en mi lista al guardarla', 'No se puede reservar sin fecha', 'Solo el propietario puede cancelar'], negative: 'Si el espacio ya está ocupado se muestra un aviso y no se guarda' },
  architecture: { architecture: 'client-api', data: 'Reserva con título, fecha, espacio y propietario', accessFlow: 'El usuario inicia sesión y la API valida cada petición', authRule: 'Solo el propietario puede ver o cancelar su reserva', justification: 'Necesitamos datos compartidos y control de acceso en el servidor' },
  generate: { prompt: 'Crea una app de reservas de eventos universitarios con API, base de datos y autorización por propietario.' },
  construction: { matches: 'Crea y lista las reservas del usuario como pedimos', differs: 'No comprueba el propietario al consultar por id' },
  verification: { category: 'Seguridad', severity: 'Alta', description: 'Se puede consultar la reserva de otro usuario por su id', impact: 'Exposición de datos de otros estudiantes', regressionTest: 'Consultar una reserva ajena debe responder prohibido' },
  delivery: { decision: 'PUBLISH_WITH_CONDITIONS', conditions: 'Solo tras corregir la autorización por propietario', residualRisk: 'Prototipo simulado sin pruebas de carga', rollback: 'Volver a la versión anterior y desactivar reservas nuevas', improvement: 'Agregar pruebas de autorización horizontal', checklist: true }
};
async function harness(t, database = ':memory:') {
  const app = createApp({ database, password, logRequests: false });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const profiles = new Map();
  async function request(path, data, cookie, headers = {}) {
    if(path === '/auth/join' && data) data = { ...(profiles.get(cookie) ?? {fullName:'Participante de prueba',email:`${randomUUID()}@ucundinamarca.edu.co`}), ...data };
    const res = await fetch(base + '/api' + path, { method: data ? 'POST' : 'GET', headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: data ? JSON.stringify(data) : undefined });
    const result = { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
    if(path === '/auth/join' && result.cookie && res.ok) profiles.set(result.cookie,{fullName:data.fullName,email:data.email});
    return result;
  }
  const login = async (sessionId = 'tarde') => (await request('/auth/presenter', { password, sessionId })).cookie;
  const presenter = await login();
  const s = await request('/sessions/tarde/state', null, presenter);
  const participant = (await request('/auth/join', { code: s.body.joinCode, name: 'Equipo A' })).cookie;
  const command = async (action, extra = {}, cookie = presenter, id = 'tarde') => {
    const state = await request(`/sessions/${id}/state`, null, cookie);
    const result=await request(`/sessions/${id}/phase-command`, { action, expectedVersion: state.body.version, idempotencyKey: randomUUID(), ...extra }, cookie);
    // Los recorridos prácticos existentes completan ambos momentos de la fase.
    // Las pruebas de explicación llaman a request directamente para comprobar el bloqueo.
    if(result.status===200&&['START','ADVANCE','REOPEN'].includes(action))return request(`/sessions/${id}/phase-command`,{action:'PRACTICE',expectedVersion:result.body.version,idempotencyKey:randomUUID()},cookie);
    return result;
  };
  const act = async (action, extra = {}, cookie = participant) => {
    const state = await request('/sessions/tarde/state', null, cookie);
    return request(`/sessions/tarde/actions/${action}`, { ...VALID[action], expectedVersion: state.body.version, idempotencyKey: randomUUID(), ...extra }, cookie);
  };
  // Lleva la sesión a la práctica de la fase indicada con todas las entregas previas enviadas.
  const reach = async phase => {
    await command('START');
    for (const actions of [['discovery'], ['specification'], ['architecture'], ['generate', 'construction'], ['verification']].slice(0, phase - 1)) {
      for (const action of actions) assert.equal((await act(action)).status, 200, action);
      await command('ADVANCE');
    }
  };
  return { ...app, request, presenter, participant, command, act, reach, login, base };
}
test('Casos 1–6, 11, 13 y 14: seis fases AI-DSE y recorrido DEMO sin Internet', async t => {
  const h = await harness(t);
  for (const a of ['discovery','specification','architecture','generate','construction','verification','delivery']) {
    const r = await h.act(a); assert.equal(r.status,403); assert.equal(r.body.error,'PHASE_LOCKED'); assert.equal(r.body.sessionStatus,'WAITING');
  }
  assert.equal((await h.command('START')).status,200);
  assert.equal((await h.act('specification')).body.error,'PHASE_LOCKED');
  const discovered = await h.act('discovery'); assert.equal(discovered.status,200);
  assert.equal(discovered.body.team.project.deliverables[1].status,'submitted');
  const v = (await h.request('/sessions/tarde/state',null,h.presenter)).body.version;
  await h.command('PAUSE');
  assert.equal((await h.act('discovery')).status,403);
  await h.command('RESUME');
  assert.ok((await h.request('/sessions/tarde/state',null,h.presenter)).body.version>v);
  await h.command('ADVANCE'); assert.equal((await h.act('specification')).status,200);
  await h.command('ADVANCE'); assert.equal((await h.act('architecture')).status,200);
  await h.command('ADVANCE');
  const generated = await h.act('generate'); assert.equal(generated.status,200);
  const version = generated.body.team.project.versions[0];
  assert.equal(version.sourceMode,'DEMO'); assert.equal(version.projectType,'reservas');
  assert.match(version.code,/SIMULACIÓN EDUCATIVA/); assert.match(version.code,/crearReserva/); assert.doesNotMatch(version.code,/Tarea/);
  assert.equal(generated.body.team.project.deliverables[4].status,'draft');
  assert.equal((await h.act('construction')).status,200);
  await h.command('ADVANCE'); assert.equal((await h.act('verification')).status,200);
  await h.command('ADVANCE'); assert.equal((await h.act('delivery')).status,200);
  assert.equal((await h.command('ADVANCE')).body.error,'INVALID_TRANSITION');
  await h.command('FINISH',{confirm:true});
  assert.equal((await h.act('delivery')).status,403);
  const report = (await h.request('/sessions/tarde/report',null,h.participant)).body;
  assert.equal(report.team.project.deliverables[6].data.decision,'PUBLISH_WITH_CONDITIONS');
});
test('Casos 7–8: autorización de rol y aislamiento de sesiones', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/sessions/tarde/phase-command',{action:'START'},h.participant)).status,403);
  assert.equal((await h.request('/sessions/noche/state',null,h.participant)).status,403);
  await h.command('START');
  const night = await h.login('noche');
  const other = await h.request('/sessions/noche/state',null,night);
  assert.equal(other.body.status,'WAITING'); assert.equal(other.body.version,0);
  assert.equal((await h.command('START',{},h.presenter,'noche')).status,403);
});
test('Casos 9–10: hidratación, doble clic, dos controles y replay atómicos', async t => {
  const h = await harness(t);
  const b = { action:'START', expectedVersion:0, idempotencyKey:randomUUID() };
  const replies = await Promise.all([h.request('/sessions/tarde/phase-command',b,h.presenter),h.request('/sessions/tarde/phase-command',b,h.presenter)]);
  assert.deepEqual(replies.map(r=>r.status),[200,200]);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM phase_actions').get().n,1);
  assert.equal((await h.request('/sessions/tarde/phase-command',{...b,action:'FINISH'},h.presenter)).body.error,'IDEMPOTENCY_CONFLICT');
  const controller2 = await h.login();
  const contenders = await Promise.all([h.presenter,controller2].map(cookie=>h.request('/sessions/tarde/phase-command',{action:'ADVANCE',expectedVersion:1,idempotencyKey:randomUUID(),confirm:true},cookie)));
  assert.deepEqual(contenders.map(r=>r.status).sort(),[200,409]);
  const reconnected = await h.request('/sessions/tarde/state',null,h.participant);
  assert.equal(reconnected.body.activePhase,2); assert.equal(reconnected.body.permissions.discovery,false);
  assert.equal(reconnected.body.permissions.specification,false);
  assert.equal(reconnected.body.phaseStage,'THEORY');
  assert.equal((await h.request('/sessions/tarde/actions/specification',{expectedVersion:1,idempotencyKey:randomUUID()},h.participant)).body.error,'PHASE_LOCKED');
  await h.command('PRACTICE');
  assert.equal((await h.request('/sessions/tarde/actions/specification',{expectedVersion:1,idempotencyKey:randomUUID()},h.participant)).body.error,'VERSION_CONFLICT');
});
test('Caso 12: resultado tardío rechazado tras cerrar o reabrir la fase', async t => {
  const h = await harness(t);
  await h.command('START'); await h.act('discovery'); await h.command('ADVANCE');
  const version = (await h.request('/sessions/tarde/state',null,h.participant)).body.version;
  await h.command('ADVANCE',{confirm:true});
  const late = await h.request('/sessions/tarde/actions/specification',{...VALID.specification,expectedVersion:version,idempotencyKey:randomUUID()},h.participant);
  assert.equal(late.body.error,'PHASE_LOCKED');
  await h.command('REOPEN',{phase:2,confirm:true});
  assert.equal((await h.request('/sessions/tarde/actions/specification',{...VALID.specification,expectedVersion:version,idempotencyKey:randomUUID()},h.participant)).body.error,'VERSION_CONFLICT');
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).body.team.project.deliverables[2],undefined);
});
test('Caso 15: SSE sincronizado y proyector sin datos privados ni mutaciones', async t => {
  const h = await harness(t);
  const access = await h.request('/sessions/tarde/projector-access',{},h.presenter);
  const projector = (await h.request('/auth/projector',{token:access.body.token})).cookie;
  assert.equal((await h.request('/auth/projector',{token:access.body.token})).status,401);
  const abort = new AbortController();
  const response = await fetch(h.base+'/api/sessions/tarde/events',{headers:{Cookie:projector},signal:abort.signal});
  const reader = response.body.getReader();
  const initial = new TextDecoder().decode((await reader.read()).value);
  assert.ok(initial.includes('WAITING'));
  await h.command('START');
  const update = new TextDecoder().decode((await reader.read()).value);
  assert.ok(update.includes('session.started')); assert.ok(update.includes('"activePhase":1'));
  abort.abort();
  const state = (await h.request('/sessions/tarde/state',null,projector)).body;
  assert.equal(state.mode,'DEMO'); assert.equal(state.team,undefined); assert.equal(state.teams,undefined); assert.equal(state.joinCode,undefined);
  assert.deepEqual(state.leaderboard,[{name:'Equipo A',completed:0}]);
  assert.equal((await h.request('/sessions/tarde/actions/discovery',{...VALID.discovery,idempotencyKey:'a'},projector)).status,403);
  assert.equal((await h.request('/sessions/tarde/phase-command',{action:'START'},projector)).status,403);
});
test('Transacciones: precondiciones, borradores, idempotencia y revisión de coherencia al retroceder', async t => {
  const h=await harness(t);
  await h.command('START');
  assert.equal((await h.command('ADVANCE')).body.error,'INCOMPLETE_TEAMS');
  await h.command('REOPEN',{phase:4,confirm:true});
  assert.equal((await h.act('generate')).body.error,'DISCOVERY_REQUIRED');
  await h.command('REOPEN',{phase:1,confirm:true});
  assert.equal((await h.act('discovery',{features:['Solo una']})).body.error,'DELIVERABLE_INVALID');
  assert.equal((await h.act('discovery',{projectType:'inventado'})).body.field,'projectType');
  const draft = await h.act('discovery',{draft:true,problem:'',features:['Crear reserva']});
  assert.equal(draft.body.team.project.deliverables[1].status,'draft');
  assert.equal((await h.request('/sessions/tarde/state',null,h.presenter)).body.summary.completed,0);
  await h.act('discovery');
  await h.command('ADVANCE'); await h.act('specification');
  await h.command('ADVANCE'); await h.act('architecture');
  await h.command('ADVANCE');
  const version=(await h.request('/sessions/tarde/state',null,h.participant)).body.version;
  const b={...VALID.generate,expectedVersion:version,idempotencyKey:randomUUID()};
  await h.request('/sessions/tarde/actions/generate',b,h.participant);
  await h.request('/sessions/tarde/actions/generate',b,h.participant);
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).body.team.project.versions.length,1);
  assert.equal((await h.act('construction',{matches:'corto'})).body.field,'matches');
  await h.act('construction');
  await h.command('REOPEN',{phase:1,confirm:true});
  await h.act('discovery',{problem:'Otro problema distinto para el mismo usuario'});
  const project=(await h.request('/sessions/tarde/state',null,h.participant)).body.team.project;
  assert.equal(project.deliverables[1].revisions.length,2);
  for (const phase of [2,3,4]) assert.equal(project.deliverables[phase].status,'needs_review');
  assert.deepEqual(project.deliverables[2].data.stories,VALID.specification.stories);
  await h.command('REOPEN',{phase:5,confirm:true});
  assert.equal((await h.act('verification')).body.error,'CONSTRUCTION_REQUIRED');
});
test('Cookies, origen, logout, validación y archivos privados', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/sessions/tarde/state')).status,401);
  assert.equal((await h.request('/auth/presenter',{password,sessionId:'tarde'},null,{Origin:'https://attacker.example'})).status,403);
  for (const path of ['/.env','/services/api/server.mjs','/data/ingenia.sqlite','/TODO_IngenIA.md']) assert.equal((await fetch(h.base+path)).status,404);
  const login = await fetch(h.base+'/api/auth/presenter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,sessionId:'tarde'})});
  assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal((await h.request('/auth/logout',{},h.participant)).status,200);
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).status,401);
});
test('Reloj: pausa congela, extensión suma y reanudación usa tiempo restante', () => {
  let s = {status:'WAITING',activePhase:null,version:0,remainingMs:0,deadline:null};
  s=transition(s,{action:'START'},1000); assert.equal(s.deadline,null);
  s=transition(s,{action:'PRACTICE',seconds:60},1000); assert.equal(s.deadline,61000);
  s=transition(s,{action:'PAUSE'},11000); assert.equal(s.remainingMs,50000);
  s=transition(s,{action:'EXTEND',seconds:10},20000); assert.equal(s.remainingMs,60000);
  s=transition(s,{action:'RESUME'},50000); assert.equal(s.deadline,110000);
  assert.throws(()=>transition(s,{action:'REOPEN',phase:5}),/CONFIRMATION_REQUIRED/);
  s=transition(s,{action:'EXTEND',seconds:60},200000); assert.equal(s.deadline,260000);
  let fresh=transition(transition({status:'WAITING',activePhase:null,version:0,remainingMs:0,deadline:null},{action:'START'},0),{action:'PRACTICE'},0);
  assert.equal(fresh.deadline,12*60*1000);
});
test('Persistencia: reiniciar conserva versión de sesión', async t => {
  const dir=mkdtempSync(join(tmpdir(),'ingenia-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'state.sqlite');
  const first=createApp({database:path,password});
  first.db.prepare('UPDATE sessions SET data=json_set(data,\'$.version\',7) WHERE id=?').run('tarde');
  await first.close();
  const second=createApp({database:path,password});
  assert.equal(JSON.parse(second.db.prepare('SELECT data FROM sessions WHERE id=?').get('tarde').data).version,7);
  await second.close();
});

test('Vistas separadas: participante sin acceso a Studio, proyector o sus APIs', async t => {
  const h = await harness(t);
  for (const path of ['/studio', '/presenter', '/projector', '/apps/presenter/index.html', '/apps/projector/index.html']) {
    assert.equal((await fetch(h.base+path,{headers:{Cookie:h.participant}})).status,403,path);
  }
  for (const path of ['/studio/me','/projection/me','/studio/sessions/tarde/state','/projection/sessions/tarde/state']) {
    assert.equal((await h.request(path,null,h.participant)).status,401,path);
  }
  assert.equal((await h.request('/sessions/tarde/projector-access',{},h.participant)).status,403);
  const student = await fetch(h.base+'/',{headers:{Cookie:h.participant}});
  assert.equal(student.status,200);
  assert.equal((await h.request('/me',null,h.participant)).body.role,'PARTICIPANT');
});

test('Studio abre proyector en el mismo navegador sin reemplazar los accesos', async t => {
  const h = await harness(t);
  const access = await h.request('/studio/sessions/tarde/projector-access',{},h.presenter);
  assert.equal(access.status,201);
  const exchange = await h.request('/projection/auth/projector',{token:access.body.token},h.presenter);
  assert.equal(exchange.status,200);
  assert.match(h.presenter,/^ingenia_presenter=/);
  assert.match(exchange.cookie,/^ingenia_projector=/);
  const cookies = [h.participant,h.presenter,exchange.cookie].join('; ');
  assert.equal((await h.request('/studio/me',null,cookies)).body.role,'PRESENTER');
  assert.equal((await h.request('/projection/me',null,cookies)).body.role,'PROJECTOR');
  assert.equal((await h.request('/me',null,cookies)).body.role,'PARTICIPANT');
  for (const path of ['/presenter','/projector']) assert.equal((await fetch(h.base+path,{headers:{Cookie:cookies}})).status,200);
  const display = (await h.request('/projection/sessions/tarde/state',null,cookies)).body;
  assert.equal(display.teams,undefined); assert.equal(display.joinCode,undefined);
  assert.equal((await h.request('/projection/sessions/tarde/phase-command',{action:'START'},cookies)).status,403);
  await h.request('/projection/auth/logout',{},cookies);
  assert.equal((await h.request('/projection/me',null,cookies)).status,401);
  assert.equal((await h.request('/studio/me',null,cookies)).body.role,'PRESENTER');
});


test('Ingreso: el horario seleccionado debe coincidir con el código de sala', async t => {
  const h = await harness(t);
  const state = (await h.request('/sessions/tarde/state',null,h.presenter)).body;
  const wrong = await h.request('/auth/join',{code:state.joinCode,name:'Equipo horario',sessionId:'noche'});
  assert.equal(wrong.status,400); assert.equal(wrong.body.error,'INVALID_JOIN');
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM teams').get().n,1);
  const correct = await h.request('/auth/join',{code:state.joinCode,name:'Equipo horario',sessionId:'tarde'});
  assert.equal(correct.status,201); assert.equal(correct.body.sessionId,'tarde');
});

test('Equipo compartido: seis integrantes, sugerencias, nombre canónico y límite concurrente', async t => {
  const h = await harness(t);
  const code=(await h.request('/sessions/tarde/state',null,h.presenter)).body.joinCode;
  const suggested=await h.request('/team-search',{code,sessionId:'tarde',query:'eQuI'});
  assert.equal(suggested.status,200); assert.equal(suggested.body.teams[0].name,'Equipo A');
  assert.equal(suggested.body.teams[0].memberCount,1);
  assert.deepEqual(Object.keys(suggested.body.teams[0]).sort(),['full','id','memberCount','name','sessionId','sessionTitle']);
  const teamId=suggested.body.teams[0].id;
  const replies=await Promise.all(Array.from({length:7},()=>h.request('/auth/join',{code,name:'  EQUIPO   a  ',sessionId:'tarde',teamId})));
  assert.equal(replies.filter(r=>r.status===201).length,5);
  assert.equal(replies.filter(r=>r.body.error==='TEAM_FULL').length,2);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM teams').get().n,1);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM identities WHERE role='PARTICIPANT'").get().n,6);
  const state=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
  assert.equal(state.summary.total,1); assert.equal(state.summary.participants,6);
  assert.equal(state.teams[0].memberCount,6);
  const member=replies.find(r=>r.cookie).cookie;
  await h.command('START');
  await h.act('discovery',{problem:'Un problema compartido por los seis integrantes del equipo'},member);
  const other=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  assert.equal(other.team.project.deliverables[1].data.problem,'Un problema compartido por los seis integrantes del equipo');
  assert.equal((await h.request('/sessions/tarde/state',null,h.presenter)).body.summary.completed,1);
  const rejoin=await h.request('/auth/join',{code,name:'equipo a'},h.participant);
  assert.equal(rejoin.status,200);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM identities WHERE role='PARTICIPANT'").get().n,6);
  assert.equal((await h.request('/team-search',{code,sessionId:'tarde',query:'equipo'})).body.teams[0].full,true);
});

test('Nombres equivalentes crean un solo equipo incluso con primeros ingresos simultáneos', async t => {
  const h=await harness(t);
  const code=(await h.request('/sessions/tarde/state',null,h.presenter)).body.joinCode;
  const replies=await Promise.all(['Los Innovadores','LOS  INNOVADORES','  los innovadores  '].map(name=>h.request('/auth/join',{code,name,sessionId:'tarde'})));
  assert.ok(replies.every(r=>r.status===201));
  assert.equal(new Set(replies.map(r=>r.body.teamId)).size,1);
  const teams=(await h.request('/team-search',{code,sessionId:'tarde',query:'los'})).body.teams;
  assert.equal(teams.length,1); assert.equal(teams[0].memberCount,3);
  assert.equal((await h.request('/team-search',{code,sessionId:'noche',query:'los'})).status,400);
  assert.equal((await h.request('/team-search',{code:'INVALIDO',sessionId:'tarde',query:'los'})).status,400);
  assert.equal((await h.request('/auth/join',{code,name:'Los Innovadores',teamId:'id-manipulado'})).body.error,'TEAM_SELECTION_CHANGED');
});

test('Ingreso sin código: sesión elegida genera identificador estadístico y aísla equipos', async t => {
  const h=await harness(t);
  const join=await h.request('/auth/join',{sessionId:'tarde',name:'Equipo sin código'});
  assert.equal(join.status,201);
  assert.equal(join.body.statisticsCode,'ING-20261118-1400-TARDE');
  const search=await h.request('/team-search',{sessionId:'tarde',query:'equipo sin'});
  assert.equal(search.body.teams[0].id,join.body.teamId);
  assert.equal((await h.request('/team-search',{sessionId:'noche',query:'equipo sin'})).body.teams.length,0);
  const night=await h.request('/auth/join',{sessionId:'noche',name:'Equipo sin código'});
  assert.equal(night.body.statisticsCode,'ING-20261118-1800-NOCHE');
  assert.notEqual(night.body.teamId,join.body.teamId);
  const report=await h.request('/sessions/tarde/report',null,join.cookie);
  assert.equal(report.body.statisticsCode,join.body.statisticsCode);
  assert.equal((await h.request('/auth/join',{name:'Sin sesión'})).status,400);
  assert.equal((await h.request('/auth/join',{sessionId:'inventada',name:'Sin sesión'})).status,400);
  assert.equal((await h.request('/team-search',{sessionId:'inventada',query:'equipo'})).status,400);
  const presenter=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
  assert.equal(presenter.statisticsCode,join.body.statisticsCode);
});

test('Notas personales: persisten por participante, sin compartirlas con equipo o Studio', async t => {
  const h=await harness(t);
  const other=await h.request('/auth/join',{sessionId:'tarde',name:'Equipo A'});
  assert.equal((await h.request('/notes',{content:'Mi aprendizaje personal del evento',expectedVersion:0},h.participant)).status,200);
  const mine=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  assert.equal(mine.note.content,'Mi aprendizaje personal del evento');
  assert.equal(mine.note.version,1);
  assert.equal((await h.request('/sessions/tarde/state',null,other.cookie)).body.note.content,'');
  assert.equal((await h.request('/sessions/tarde/state',null,h.presenter)).body.note,undefined);
  assert.equal((await h.request('/notes',{content:'Intento desde Studio',expectedVersion:0},h.presenter)).status,403);
  assert.equal((await h.request('/notes',{content:'Versión obsoleta',expectedVersion:0},h.participant)).body.error,'NOTE_VERSION_CONFLICT');
  assert.equal((await h.request('/notes',{content:'x'.repeat(3001),expectedVersion:1},h.participant)).status,400);
  await h.command('START'); await h.command('PAUSE');
  assert.equal((await h.request('/notes',{content:'En pausa',expectedVersion:1},h.participant)).body.error,'NOTES_READ_ONLY');
  await h.command('RESUME');
  assert.equal((await h.request('/notes',{content:'Apuntes actualizados',expectedVersion:1},h.participant)).status,200);
  await h.command('FINISH',{confirm:true});
  assert.equal((await h.request('/notes',{content:'Después del cierre',expectedVersion:2},h.participant)).status,403);
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).body.note.content,'Apuntes actualizados');
});


test('Identidad nominal y roles únicos: seis puestos sin elevar permisos de aplicación', async t => {
  const h=await harness(t);
  const members=[h.participant];
  for(let i=0;i<5;i++) members.push((await h.request('/auth/join',{sessionId:'tarde',name:'Equipo A',fullName:`Persona Prueba ${i}`,email:`persona${i}@ucundinamarca.edu.co`})).cookie);
  const states=await Promise.all(members.map(cookie=>h.request('/sessions/tarde/state',null,cookie)));
  assert.deepEqual(states.map(r=>r.body.profile.teamRole),['Product','Tech Lead','AI Developer','QA','Security','DevOps']);
  assert.ok(states.every(r=>r.body.role==='PARTICIPANT'));
  assert.equal(states[1].body.profile.fullName,'Persona Prueba 0');
  const duplicate=await h.request('/auth/join',{sessionId:'tarde',name:'Otro equipo',fullName:'Otra persona',email:'PERSONA0@UCUNDINAMARCA.EDU.CO'});
  assert.equal(duplicate.body.error,'TEAM_CHANGE_NOT_ALLOWED');
  assert.equal((await h.request('/auth/join',{sessionId:'tarde',name:'Otra',fullName:'',email:'no-valido'})).status,400);
  assert.equal((await h.request('/sessions/tarde/state',null,h.presenter)).body.profile,undefined);
  assert.equal((await h.request('/team-search',{sessionId:'tarde',query:'equipo'})).body.teams[0].email,undefined);
});


test('Autocompletado sin horario: coincidencias parciales, sesión y separación al filtrar', async t => {
  const h=await harness(t);
  await h.request('/auth/join',{sessionId:'tarde',name:'Los Meros'});
  await h.request('/auth/join',{sessionId:'noche',name:'Los Meros'});
  const result=await h.request('/team-search',{query:'mEr'});
  assert.equal(result.status,200); assert.equal(result.body.teams.length,2);
  assert.deepEqual(result.body.teams.map(team=>team.sessionId).sort(),['noche','tarde']);
  assert.ok(result.body.teams.every(team=>team.name==='Los Meros' && team.sessionTitle));
  const filtered=await h.request('/team-search',{sessionId:'tarde',query:'mer'});
  assert.equal(filtered.body.teams.length,1); assert.equal(filtered.body.teams[0].sessionId,'tarde');
  assert.equal((await h.request('/team-search',{query:''})).body.teams.length,0);
  assert.equal((await h.request('/team-search',{query:'sin coincidencias'})).body.teams.length,0);
  await h.command('FINISH',{confirm:true});
  const open=await h.request('/team-search',{query:'mer'});
  assert.equal(open.body.teams.length,1); assert.equal(open.body.teams[0].sessionId,'noche');
});

async function registrationFor(h,cookie=h.participant) {
  const state=(await h.request('/sessions/tarde/state',null,cookie)).body;
  return {sessionId:'tarde',name:state.team.name,fullName:state.profile.fullName,email:state.profile.email};
}
test('Reingreso sin cookie conserva identidad, rol, equipo, notas y proyecto; revoca acceso anterior', async t=>{
  const h=await harness(t); const registration=await registrationFor(h);
  await h.command('START'); await h.act('discovery',{problem:'Problema original que debe conservarse al recuperar acceso'});
  await h.request('/notes',{content:'Apuntes privados que deben conservarse',expectedVersion:0},h.participant);
  const before=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  const resumed=await h.request('/auth/join',registration);
  assert.equal(resumed.status,200); assert.ok(resumed.cookie); assert.notEqual(resumed.cookie,h.participant);
  assert.equal((await h.request('/me',null,h.participant)).status,401);
  const after=(await h.request('/sessions/tarde/state',null,resumed.cookie)).body;
  assert.deepEqual(after.profile,before.profile); assert.deepEqual(after.team,before.team); assert.deepEqual(after.note,before.note);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM identities WHERE role='PARTICIPANT'").get().n,1);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM tokens WHERE identity_id=(SELECT identity_id FROM participant_profiles WHERE email=?)').get(registration.email).n,1);
});
test('Cambiar de equipo al recuperar acceso se rechaza sin invalidar el acceso correcto', async t=>{
  const h=await harness(t); const registration=await registrationFor(h);
  const alternate=await h.request('/auth/join',{sessionId:'tarde',name:'Equipo alternativo'});
  for(const payload of [{...registration,name:'Equipo alternativo'},{...registration,teamId:alternate.body.teamId}]) {
    const denied=await h.request('/auth/join',payload);
    assert.equal(denied.body.error,'TEAM_CHANGE_NOT_ALLOWED');
    assert.equal((await h.request('/me',null,h.participant)).status,200);
  }
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM teams').get().n,2);
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).body.team.memberCount,1);
  const newEmail={...registration,email:'otra-identidad@ucundinamarca.edu.co'};
  assert.equal((await h.request('/auth/join',newEmail,h.participant)).body.error,'IDENTITY_MISMATCH');
  assert.equal((await h.request('/me',null,h.participant)).status,200);
});
test('Cambiar de horario no traslada equipos, roles, notas ni entregas; recuperar grupo previo restaura su trabajo', async t=>{
  const h=await harness(t); const registration=await registrationFor(h);
  await h.request('/notes',{content:'Notas exclusivas del grupo tarde',expectedVersion:0},h.participant);
  const night=await h.request('/auth/join',{...registration,sessionId:'noche'},h.participant);
  assert.equal(night.status,201);
  assert.equal((await h.request('/me',null,h.participant)).status,401);
  const nightState=(await h.request('/sessions/noche/state',null,night.cookie)).body;
  assert.equal(nightState.note.content,''); assert.equal(nightState.team.memberCount,1);
  assert.equal((await h.request('/sessions/tarde/state',null,night.cookie)).status,403);
  const returned=await h.request('/auth/join',registration,night.cookie);
  assert.equal(returned.status,200);
  assert.equal((await h.request('/me',null,night.cookie)).status,401);
  const restored=(await h.request('/sessions/tarde/state',null,returned.cookie)).body;
  assert.equal(restored.note.content,'Notas exclusivas del grupo tarde');
  assert.notEqual(restored.team.id,nightState.team.id);
  assert.equal((await h.request('/auth/join',{...registration,sessionId:'inexistente'})).status,400);
  assert.equal((await h.request('/me',null,returned.cookie)).status,200);
});
test('Dos reingresos simultáneos dejan un único token vigente; el equipo no suma miembros',async t=>{
  const h=await harness(t);const registration=await registrationFor(h);
  const replies=await Promise.all([h.request('/auth/join',registration),h.request('/auth/join',registration)]);
  assert.ok(replies.every(r=>r.status===200));
  const states=await Promise.all(replies.map(r=>h.request('/me',null,r.cookie)));
  assert.deepEqual(states.map(r=>r.status).sort(),[200,401]);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM participant_profiles').get().n,1);
});
test('Reingreso revoca también el stream SSE del navegador anterior',async t=>{
  const h=await harness(t);const registration=await registrationFor(h);
  const abort=new AbortController();t.after(()=>abort.abort());
  const response=await fetch(h.base+'/api/sessions/tarde/events',{headers:{Cookie:h.participant},signal:abort.signal});
  const reader=response.body.getReader();await reader.read();
  await h.request('/auth/join',registration);
  assert.equal((await reader.read()).done,true);
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).status,401);
});
test('Recuperar después de logout, pausa y cierre mantiene lectura y bloqueos del taller',async t=>{
  const h=await harness(t); const registration=await registrationFor(h);
  await h.request('/auth/logout',{},h.participant);
  const recovered=await h.request('/auth/join',registration);assert.equal(recovered.status,200);
  await h.command('START');await h.command('PAUSE');
  const paused=await h.request('/auth/join',registration);assert.equal(paused.status,200);
  assert.equal((await h.act('discovery',{},paused.cookie)).status,403);
  await h.command('FINISH',{confirm:true});
  const closed=await h.request('/auth/join',registration);assert.equal(closed.status,200);
  assert.equal((await h.request('/sessions/tarde/state',null,closed.cookie)).body.status,'FINISHED');
  assert.equal((await h.act('discovery',{},closed.cookie)).status,403);
  assert.equal((await h.request('/auth/join',{sessionId:'tarde',name:'Otro equipo'})).body.error,'SESSION_FINISHED');
});

test('Un equipo lleno permite recuperar un miembro existente, pero rechaza al séptimo nuevo',async t=>{
  const h=await harness(t); const registration=await registrationFor(h);
  for(let i=0;i<5;i++) assert.equal((await h.request('/auth/join',{sessionId:'tarde',name:'Equipo A'})).status,201);
  const recovered=await h.request('/auth/join',registration);
  assert.equal(recovered.status,200);
  assert.equal((await h.request('/sessions/tarde/state',null,recovered.cookie)).body.team.memberCount,6);
  assert.equal((await h.request('/auth/join',{sessionId:'tarde',name:'Equipo A'})).body.error,'TEAM_FULL');
});

test('Studio y proyector sin integración de presentaciones ni captura',async t=>{
  const h=await harness(t);
  const access=await h.request('/sessions/tarde/projector-access',{},h.presenter);
  const projector=(await h.request('/auth/projector',{token:access.body.token})).cookie;
  for(const cookie of [h.presenter,projector]) {
    const state=(await h.request('/sessions/tarde/state',null,cookie)).body;
    assert.equal(state.presentation,undefined);
    for(const route of ['presentation','live']) assert.equal((await h.request(`/sessions/tarde/${route}`,{action:'START'},cookie)).status,405);
  }
});

test('Seis fases: teoría bloqueada, práctica, reflexión, cierre, pausa y cronómetro',async t=>{
 const h=await harness(t);
 const command=async(action,extra={})=>{
  const s=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
  return h.request('/sessions/tarde/phase-command',{action,expectedVersion:s.version,idempotencyKey:randomUUID(),...extra},h.presenter);
 };
 const actions=['discovery','specification','architecture','generate','verification','delivery'];
 for(let phase=1;phase<=6;phase++){
  const opened=await command(phase===1?'START':'ADVANCE',{confirm:true});
  assert.equal(opened.body.phaseStage,'THEORY');assert.equal(opened.body.deadline,null);assert.equal(opened.body.activePhase,phase);
  let student=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  assert.equal(Object.values(student.permissions).some(Boolean),false);
  assert.equal((await h.act(actions[phase-1])).body.error,'PHASE_LOCKED');
  assert.equal((await command('EXTEND')).status,409);
  assert.equal((await command('REFLECT')).status,409);
  await command('PAUSE');assert.equal((await command('PRACTICE')).status,409);
  assert.equal((await command('RESUME')).body.deadline,null);
  const practice=await command('PRACTICE',{seconds:60});
  assert.equal(practice.status,200);assert.equal(practice.body.phaseStage,'PRACTICE');assert.ok(practice.body.deadline>Date.now());
  student=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  assert.equal(student.permissions[actions[phase-1]],true);
  assert.equal((await command('PRACTICE')).status,409);
  const reflection=await command('REFLECT');
  assert.equal(reflection.body.phaseStage,'REFLECTION');assert.equal(reflection.body.deadline,null);
  assert.equal((await h.act(actions[phase-1])).body.error,'PHASE_LOCKED');
  assert.equal((await command('CLOSE')).body.phaseStage,'CLOSED');
  assert.equal((await command('CLOSE')).status,409);
 }
 assert.equal((await command('ADVANCE')).status,409);
 const reopened=await command('REOPEN',{phase:2,confirm:true});assert.equal(reopened.body.phaseStage,'THEORY');
 const state=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
 assert.equal((await h.request('/sessions/tarde/phase-command',{action:'PRACTICE',expectedVersion:state.version,idempotencyKey:randomUUID()},h.participant)).status,403);
});
test('Notas del conferencista: seis fases, privacidad, sesión, versiones y persistencia',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ingenia-speaker-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const database=join(dir,'test.sqlite');const h=await harness(t,database);
 const path='/sessions/tarde/phase-notes';
 const access=await h.request('/sessions/tarde/projector-access',{},h.presenter);
 const projector=(await h.request('/auth/projector',{token:access.body.token})).cookie;
 for(let phase=1;phase<=6;phase++){
  const result=await h.request(path,{phase,content:`Puntos privados fase ${phase}`,expectedVersion:0},h.presenter);
  assert.equal(result.status,200);assert.equal(result.body.note.version,1);
 }
 const presenter=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
 assert.equal(presenter.version,0);assert.equal(Object.keys(presenter.phaseNotes).length,6);
 for(const cookie of [h.participant,projector]){
  assert.equal((await h.request('/sessions/tarde/state',null,cookie)).body.phaseNotes,undefined);
  assert.equal((await h.request(path,{phase:1,content:'intento',expectedVersion:1},cookie)).status,403);
 }
 assert.equal((await h.request('/sessions/noche/phase-notes',{phase:1,content:'intento',expectedVersion:0},h.presenter)).status,403);
 const night=await h.login('noche');assert.deepEqual((await h.request('/sessions/noche/state',null,night)).body.phaseNotes,{});
 for(const phase of [0,7,'1'])assert.equal((await h.request(path,{phase,content:'inválido',expectedVersion:0},h.presenter)).status,400);
 assert.equal((await h.request(path,{phase:1,content:'x'.repeat(6001),expectedVersion:1},h.presenter)).status,400);
 const contenders=await Promise.all(['primero','segundo'].map(content=>h.request(path,{phase:1,content,expectedVersion:1},h.presenter)));
 assert.deepEqual(contenders.map(r=>r.status).sort(),[200,409]);
 const reopened=await harness(t,database);
 assert.equal((await reopened.request('/sessions/tarde/state',null,reopened.presenter)).body.phaseNotes[1].version,2);
 assert.equal((await h.request(path,{phase:1,content:'',expectedVersion:2},h.presenter)).body.note.content,'');
});
test('Revisión: solo Studio elige entregas de su sesión; proyector sin identidades ni notas',async t=>{
 const h=await harness(t),path='/sessions/tarde/team-review';
 const team=(await h.request('/sessions/tarde/state',null,h.participant)).body.team;
 const access=await h.request('/sessions/tarde/projector-access',{},h.presenter);
 const projector=(await h.request('/auth/projector',{token:access.body.token})).cookie;
 const review=async(action,extra={})=>{
  const s=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
  return h.request(path,{action,expectedVersion:s.teamReview.version,...extra},h.presenter);
 };
 for(const cookie of [h.participant,projector])assert.equal((await h.request(path,{action:'SHOW',teamId:team.id,expectedVersion:0},cookie)).status,403);
 assert.equal((await review('SHOW',{teamId:team.id})).body.error,'REVIEW_PRACTICE_REQUIRED');
 await h.command('START');
 assert.equal((await review('SHOW',{teamId:team.id})).body.error,'TEAM_WORK_REQUIRED');
 assert.equal((await review('SHOW',{teamId:'missing'})).status,404);
 assert.equal((await review('SHOW',{teamId:{}})).status,400);
 await h.act('discovery',{problem:'Idea del equipo para compartir con todos en el auditorio'});
 await h.request('/sessions/tarde/phase-notes',{phase:1,content:'Notas secretas del conferencista',expectedVersion:0},h.presenter);
 await h.request('/notes',{content:'Notas privadas del participante',expectedVersion:0},h.participant);
 let s=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
 await h.request('/auth/join',{sessionId:'tarde',name:team.name,fullName:'Integrante segundo',email:'segundo@example.com'});
 const shown=await review('SHOW',{teamId:team.id});assert.equal(shown.status,200);
 assert.equal(shown.body.version,s.version);assert.equal(shown.body.teamReview.memberCount,2);
 const projection=(await h.request('/sessions/tarde/state',null,projector)).body;
 assert.equal(projection.teamReview.teamName,team.name);assert.match(projection.teamReview.pages[0],/Idea del equipo/);
 assert.equal(projection.phaseNotes,undefined);assert.equal(projection.teams,undefined);
 assert.doesNotMatch(JSON.stringify(projection),/segundo@example.com|Integrante segundo|Notas secretas|Notas privadas/);
 assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).body.teamReview,undefined);
 const night=await h.login('noche');
 assert.equal((await h.request('/sessions/noche/team-review',{action:'SHOW',teamId:team.id,expectedVersion:0},night)).body.error,'REVIEW_PRACTICE_REQUIRED');
 assert.equal((await h.request('/sessions/noche/team-review',{action:'HIDE',expectedVersion:0},h.presenter)).status,403);
 assert.equal((await h.request(path,{action:'HIDE',expectedVersion:0},h.presenter)).body.error,'REVIEW_VERSION_CONFLICT');
 assert.equal((await review('PAGE',{page:-1})).status,400);
 assert.equal((await review('HIDE')).body.teamReview.visible,false);
 assert.equal((await review('PAGE',{page:0})).status,400);
 await review('SHOW',{teamId:team.id});
 await h.act('discovery',{problem:'La idea se modificó mientras el equipo estaba hablando'});
 assert.match((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.pages[0],/Idea del equipo/);
 assert.match((await review('SHOW',{teamId:team.id})).body.teamReview.pages[0],/idea se modificó/);
 await h.command('ADVANCE');assert.equal((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.visible,false);
});
test('Revisión: seis fases, paginación, SSE, pausa y cierre sin reiniciar el taller',async t=>{
 const h=await harness(t),path='/sessions/tarde/team-review';
 const team=(await h.request('/sessions/tarde/state',null,h.participant)).body.team;
 const access=await h.request('/sessions/tarde/projector-access',{},h.presenter);
 const projector=(await h.request('/auth/projector',{token:access.body.token})).cookie;
 const show=async()=>{
  const state=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
  return h.request(path,{action:'SHOW',teamId:team.id,expectedVersion:state.teamReview.version},h.presenter);
 };
 await h.command('START');await h.act('discovery',{user:'Usuario descrito con detalle. '.repeat(13),problem:'Idea larga del equipo. '.repeat(25),constraint:'Restricción larga. '.repeat(20)});
 const abort=new AbortController();
 const response=await fetch(h.base+'/api/projection/sessions/tarde/events',{headers:{Cookie:projector},signal:abort.signal});
 const reader=response.body.getReader();await reader.read();
 let shown=await show();assert.equal(shown.body.teamReview.phase,1);assert.ok(shown.body.teamReview.pages.length>1);
 const event=new TextDecoder().decode((await reader.read()).value);assert.match(event,/team.review.updated/);abort.abort();
 let paged=await h.request(path,{action:'PAGE',page:1,expectedVersion:shown.body.teamReview.version},h.presenter);
 assert.equal(paged.body.teamReview.page,1);
 await h.command('PAUSE');assert.equal((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.visible,true);await h.command('RESUME');
 const pages=async()=>(await show()).body.teamReview.pages.join('');
 await h.command('ADVANCE');await h.act('specification');assert.match(await pages(),/Criterios de aceptación/);
 await h.command('ADVANCE');await h.act('architecture');assert.match(await pages(),/Regla de autorización/);
 await h.command('ADVANCE');await h.act('generate');await h.act('construction');assert.match(await pages(),/FICTICIA_NO_USAR/);
 await h.command('ADVANCE');await h.act('verification');assert.match(await pages(),/Prueba de regresión/);
 await h.command('ADVANCE');await h.act('delivery');const last=await pages();assert.match(last,/Publicar con condiciones/);assert.match(last,/autorización horizontal/);
 await h.command('FINISH',{confirm:true});assert.equal((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.visible,false);
 assert.ok(h.db.prepare("SELECT COUNT(*) n FROM phase_actions WHERE data LIKE '%TEAM_REVIEW_%'").get().n>=7);
});
test('Ciclo de mejora: desde Verificación se vuelve a Construcción con prompt ajustado hasta tres iteraciones', async t => {
  const h = await harness(t);
  const cycle = async () => {
    assert.equal((await h.act('generate')).status, 200);
    assert.equal((await h.act('construction')).status, 200); await h.command('ADVANCE');
    assert.equal((await h.act('verification')).status, 200);
  };
  await h.reach(4);
  assert.equal((await h.command('ITERATE', { confirm: true })).body.error, 'INVALID_TRANSITION');
  await cycle();
  assert.equal((await h.command('ITERATE')).body.error, 'CONFIRMATION_REQUIRED');
  const second = await h.command('ITERATE', { confirm: true });
  assert.equal(second.status, 200);
  assert.equal(second.body.activePhase, 4); assert.equal(second.body.phaseStage, 'PRACTICE'); assert.equal(second.body.iteration, 2);
  let project = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.project;
  assert.equal(project.deliverables[4], undefined); assert.equal(project.deliverables[5], undefined);
  assert.deepEqual([1,2,3].map(phase => project.deliverables[phase].status), ['submitted','submitted','submitted']);
  assert.deepEqual(project.archive.map(entry => [entry.phase, entry.iteration]), [[4,1],[5,1]]);
  assert.equal(project.versions.length, 1);
  assert.equal((await h.act('verification')).body.error, 'PHASE_LOCKED');
  assert.equal((await h.act('construction')).body.error, 'PROTOTYPE_REQUIRED');
  assert.equal((await h.act('generate', { prompt: 'corto' })).body.error, 'PROMPT_LENGTH');
  const adjusted = 'Crea la app de reservas comprobando en el servidor que cada reserva pertenece a quien la consulta.';
  assert.equal((await h.act('generate', { prompt: adjusted })).status, 200);
  project = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.project;
  assert.equal(project.versions.at(-1).prompt, adjusted); assert.equal(project.versions.at(-1).iteration, 2);
  for (let i = 0; i < 2; i++) assert.equal((await h.act('generate')).status, 200);
  assert.equal((await h.act('generate')).body.error, 'ITERATION_LIMIT');
  await h.act('construction'); await h.command('ADVANCE'); await h.act('verification');
  assert.equal((await h.command('ITERATE', { confirm: true })).body.iteration, 3);
  await cycle();
  assert.equal((await h.command('ITERATE', { confirm: true })).body.error, 'ITERATION_LIMIT');
  assert.equal((await h.command('ADVANCE')).body.activePhase, 6);
});
test('Studio elimina integrantes y equipos: revoca accesos, borra datos y libera el nombre', async t => {
  const h = await harness(t);
  const code = (await h.request('/sessions/tarde/state', null, h.presenter)).body.joinCode;
  const second = (await h.request('/auth/join', { code, name: 'Equipo A' })).cookie;
  const other = (await h.request('/auth/join', { code, name: 'Equipo B' })).cookie;
  const admin = (payload, cookie = h.presenter) => h.request('/sessions/tarde/team-admin', payload, cookie);
  let teams = (await h.request('/sessions/tarde/state', null, h.presenter)).body.teams;
  const teamA = teams.find(team => team.name === 'Equipo A'), teamB = teams.find(team => team.name === 'Equipo B');
  assert.equal(teamA.members.length, 2); assert.ok(teamA.members.every(member => member.id));
  assert.equal((await admin({ action: 'REMOVE_TEAM', teamId: teamB.id }, h.participant)).status, 403);
  assert.equal((await admin({ action: 'REMOVE_MEMBER', memberId: 'no-existe' })).body.error, 'MEMBER_NOT_FOUND');
  const removedMember = await admin({ action: 'REMOVE_MEMBER', memberId: teamA.members[1].id });
  assert.equal(removedMember.status, 200);
  assert.equal(removedMember.body.teams.find(team => team.id === teamA.id).members.length, 1);
  assert.equal((await h.request('/me', null, second)).status, 401);
  assert.equal((await h.request('/me', null, h.participant)).status, 200);
  const removedTeam = await admin({ action: 'REMOVE_TEAM', teamId: teamB.id });
  assert.equal(removedTeam.status, 200);
  assert.deepEqual(removedTeam.body.teams.map(team => team.name), ['Equipo A']);
  assert.equal((await h.request('/me', null, other)).status, 401);
  assert.equal((await admin({ action: 'REMOVE_TEAM', teamId: teamB.id })).body.error, 'TEAM_NOT_FOUND');
  assert.equal((await h.request('/auth/join', { code, name: 'Equipo B' })).status, 201);
});
test('Conectados: cuenta solo participantes con transmisión en vivo, no los registrados', async t => {
  const h = await harness(t);
  const code = (await h.request('/sessions/tarde/state', null, h.presenter)).body.joinCode;
  await h.request('/auth/join', { code, name: 'Equipo B' });
  const summary = async () => (await h.request('/sessions/tarde/state', null, h.presenter)).body.summary;
  assert.deepEqual([(await summary()).participants, (await summary()).online], [2, 0]);
  const abort = new AbortController();
  const response = await fetch(h.base + '/api/sessions/tarde/events', { headers: { Cookie: h.participant }, signal: abort.signal });
  await response.body.getReader().read();
  const second = await fetch(h.base + '/api/sessions/tarde/events', { headers: { Cookie: h.participant }, signal: abort.signal });
  await second.body.getReader().read();
  assert.equal((await summary()).online, 1);
  abort.abort();
  let online = 1;
  for (let i = 0; i < 50 && online; i++) { await new Promise(resolve => setTimeout(resolve, 10)); online = (await summary()).online; }
  assert.equal(online, 0);
});

test('Studio acepta o pide revisar entregas; el equipo lo ve y puede reenviar', async t => {
  const h = await harness(t);
  const access = await h.request('/sessions/tarde/projector-access', {}, h.presenter);
  const projector = (await h.request('/auth/projector', { token: access.body.token })).cookie;
  const teamId = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.id;
  const review = (payload, cookie = h.presenter) => h.request('/sessions/tarde/deliverable-review', { teamId, phase: 1, ...payload }, cookie);
  await h.command('START');
  assert.equal((await review({ decision: 'ACCEPT' })).body.error, 'TEAM_WORK_REQUIRED');
  await h.act('discovery', { draft: true });
  assert.equal((await review({ decision: 'ACCEPT' })).body.error, 'TEAM_WORK_REQUIRED');
  await h.act('discovery');
  let presenter = (await h.request('/sessions/tarde/state', null, h.presenter)).body;
  assert.equal(presenter.teams[0].current.status, 'submitted'); assert.match(presenter.teams[0].current.text, /Reserva de eventos universitarios/);
  for (const cookie of [h.participant, projector]) assert.equal((await review({ decision: 'ACCEPT' }, cookie)).status, 403);
  assert.equal((await review({ decision: 'MAYBE' })).status, 400);
  const requested = await review({ decision: 'REQUEST_CHANGES', comment: 'Concreten el usuario principal' });
  assert.equal(requested.body.teams[0].current.status, 'needs_review'); assert.equal(requested.body.summary.completed, 0);
  const student = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.project.deliverables[1];
  assert.equal(student.status, 'needs_review'); assert.equal(student.review.comment, 'Concreten el usuario principal');
  assert.equal((await h.act('discovery', { user: 'Estudiantes de pregrado que organizan eventos' })).body.team.project.deliverables[1].status, 'submitted');
  assert.equal((await review({ decision: 'ACCEPT' })).body.teams[0].current.status, 'accepted');
  assert.equal((await h.request('/sessions/tarde/state', null, projector)).body.leaderboard[0].completed, 1);
  assert.doesNotMatch(JSON.stringify((await h.request('/sessions/tarde/state', null, projector)).body), /Concreten|pregrado/);
  assert.ok(h.db.prepare("SELECT COUNT(*) n FROM phase_actions WHERE data LIKE '%DELIVERABLE_%'").get().n >= 2);
});
test('Concordancia: el prototipo simulado corresponde al proyecto y a la arquitectura elegidos', async () => {
  const { applyDemo } = await import('../services/api/deliverables.mjs');
  const { PROJECT_TYPES, ARCHITECTURES } = await import('../packages/shared/projects.mjs');
  const names = { reservas: 'Reserva', tareas: 'Tarea', prestamos: 'Prestamo', tutorias: 'Tutoria' };
  for (const type of PROJECT_TYPES) for (const architecture of ARCHITECTURES) {
    let project = {};
    project = applyDemo(project, 'discovery', { ...VALID.discovery, projectType: type.id });
    project = applyDemo(project, 'specification', VALID.specification);
    project = applyDemo(project, 'architecture', { ...VALID.architecture, architecture: architecture.id });
    const version = applyDemo(project, 'generate', VALID.generate).versions[0];
    assert.match(version.code, new RegExp(`crear${names[type.id]}\\(`)); assert.ok(version.code.includes(type.title));
    for (const [other, name] of Object.entries(names)) if (other !== type.id) assert.doesNotMatch(version.code, new RegExp(`crear${name}\\(`));
    assert.ok(version.scenarios.some(scenario => scenario.result === 'FAIL'));
    assert.equal(version.scenarios.length, architecture.id === 'static' ? 5 : 4);
  }
});
test('Migración AI-DSE: sesiones previas vuelven a espera y su trabajo queda para reconciliación', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'ingenia-migration-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const database = join(dir, 'legacy.sqlite');
  (await createApp({ database, password }).close());
  const legacy = new DatabaseSync(database);
  legacy.exec(`DROP TABLE presenter_phase_notes; CREATE TABLE presenter_phase_notes(session_id TEXT NOT NULL REFERENCES sessions(id), phase INTEGER NOT NULL CHECK(phase BETWEEN 1 AND 5), content TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(session_id,phase)); PRAGMA user_version=8;`);
  legacy.prepare("UPDATE sessions SET data=json_remove(json_set(data,'$.status','ACTIVE','$.activePhase',2,'$.version',4),'$.model') WHERE id='tarde'").run();
  legacy.prepare("INSERT INTO teams VALUES ('t1','tarde','Equipo previo',?)").run(JSON.stringify({ id: 't1', name: 'Equipo previo', project: { prompt: 'Idea del modelo anterior', submissions: { 1: true } } }));
  legacy.prepare("INSERT INTO presenter_phase_notes VALUES ('tarde',3,'Notas de Auditar',1,1)").run();
  legacy.close();
  const migrated = createApp({ database, password }); t.after(() => migrated.close());
  const session = JSON.parse(migrated.db.prepare("SELECT data FROM sessions WHERE id='tarde'").get().data);
  assert.equal(session.model, 'AI-DSE'); assert.equal(session.status, 'WAITING'); assert.equal(session.version, 5);
  assert.deepEqual([session.legacyReset.status, session.legacyReset.activePhase], ['ACTIVE', 2]);
  const team = JSON.parse(migrated.db.prepare("SELECT data FROM teams WHERE id='t1'").get().data);
  assert.deepEqual(team.project, {}); assert.equal(team.legacyProject.needsReconciliation, true); assert.equal(team.legacyProject.project.prompt, 'Idea del modelo anterior');
  assert.equal(migrated.db.prepare('SELECT COUNT(*) n FROM presenter_phase_notes').get().n, 0);
  assert.equal(migrated.db.prepare('SELECT content FROM presenter_phase_notes_legacy').get().content, 'Notas de Auditar');
  migrated.db.prepare("INSERT INTO presenter_phase_notes VALUES ('tarde',6,'Fase seis',1,1)").run();
  assert.equal(migrated.db.prepare('PRAGMA user_version').get().user_version, 9);
  assert.equal(JSON.parse(migrated.db.prepare("SELECT data FROM sessions WHERE id='noche'").get().data).legacyReset, undefined);
});
test('Incidentes: motor determinista, idempotente y con límites por equipo', async () => {
  const { planAssignments, INCIDENTS } = await import('../services/api/incidents.mjs');
  const teams = Array.from({ length: 10 }, (_, i) => `equipo-${String(i).padStart(2, '0')}`);
  let existing = [];
  for (let phase = 1; phase <= 6; phase++) {
    const plan = planAssignments('tarde', teams, phase, existing);
    assert.deepEqual(planAssignments('tarde', teams, phase, existing), plan);
    assert.ok(plan.every(a => INCIDENTS.find(i => i.code === a.code).phaseId === phase));
    existing = [...existing, ...plan];
    assert.deepEqual(planAssignments('tarde', teams, phase, existing), []);
  }
  for (const team of teams) {
    const own = existing.filter(a => a.teamId === team);
    assert.ok(own.length <= 2, team);
    assert.ok(own.filter(a => INCIDENTS.find(i => i.code === a.code).severity === 'Crítica').length <= 1, team);
  }
  assert.ok(new Set(existing.map(a => a.teamId)).size >= 8);
  assert.equal(planAssignments('tarde', teams, 1, []).length, 5);
  assert.deepEqual(planAssignments('tarde', teams, 1, [], { enabled: false }), []);
});
test('Incidentes: privacidad por equipo, revelado por Studio, respuesta y difusión genérica', async t => {
  const h = await harness(t);
  const other = (await h.request('/auth/join', { sessionId: 'tarde', name: 'Equipo B' })).cookie;
  const access = await h.request('/sessions/tarde/projector-access', {}, h.presenter);
  const projector = (await h.request('/auth/projector', { token: access.body.token })).cookie;
  const teamA = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.id;
  const studio = async () => (await h.request('/sessions/tarde/state', null, h.presenter)).body;
  const incidents = (payload, cookie = h.presenter) => h.request('/sessions/tarde/incidents', payload, cookie);
  await h.command('START');
  let s = await studio();
  assert.ok(s.incidents.assignments.length >= 1, 'asignación automática al iniciar la práctica');
  for (const a of s.incidents.assignments) await incidents({ action: 'UNASSIGN', teamId: a.teamId, code: a.code });
  assert.equal((await incidents({ action: 'ASSIGN', teamId: teamA, code: 'ARCH-01' })).body.error, undefined);
  assert.equal((await incidents({ action: 'REVEAL', teamId: teamA, code: 'ARCH-01' })).body.error, 'INCIDENT_PHASE_MISMATCH');
  await incidents({ action: 'UNASSIGN', teamId: teamA, code: 'ARCH-01' });
  assert.equal((await incidents({ action: 'ASSIGN', teamId: teamA, code: 'DISC-01' })).status, 200);
  assert.equal((await incidents({ action: 'ASSIGN', teamId: teamA, code: 'DISC-01' })).body.error, 'INCIDENT_ALREADY_ASSIGNED');
  for (const cookie of [h.participant, projector]) assert.equal((await incidents({ action: 'REVEAL', teamId: teamA, code: 'DISC-01' }, cookie)).status, 403);
  assert.deepEqual((await h.request('/sessions/tarde/state', null, h.participant)).body.incidents, []);
  await incidents({ action: 'REVEAL', teamId: teamA, code: 'DISC-01' });
  const mine = (await h.request('/sessions/tarde/state', null, h.participant)).body.incidents;
  assert.equal(mine.length, 1); assert.equal(mine[0].code, 'DISC-01'); assert.ok(mine[0].privateDescription);
  assert.equal(mine[0].feedback, undefined); assert.doesNotMatch(JSON.stringify(mine), /expectedChoice|expectedReasoning|learningPoint/);
  assert.deepEqual((await h.request('/sessions/tarde/state', null, other)).body.incidents, []);
  const respond = (payload, cookie = h.participant) => h.request('/sessions/tarde/incident-response', { code: 'DISC-01', choice: 'b', justification: 'Validamos usuario y problema antes de pedir código', ...payload }, cookie);
  assert.equal((await respond({}, other)).body.error, 'INCIDENT_NOT_FOUND');
  assert.equal((await respond({ choice: 'z' })).body.error, 'INCIDENT_RESPONSE_INVALID');
  assert.equal((await respond({ justification: 'corta' })).status, 400);
  assert.equal((await respond({})).body.incidents[0].status, 'acknowledged');
  assert.equal((await incidents({ action: 'HIDE', teamId: teamA, code: 'DISC-01' })).body.error, 'INCIDENT_HAS_RESPONSE');
  s = await studio();
  const studioView = s.incidents.assignments.find(a => a.code === 'DISC-01');
  assert.equal(studioView.response.choice, 'b'); assert.ok(studioView.feedback.learningPoint); assert.equal(studioView.teamName, 'Equipo A');
  assert.equal((await incidents({ action: 'SHARE', teamId: teamA, code: 'DISC-01', expectedVersion: 9 })).body.error, 'INCIDENT_SHARE_CONFLICT');
  assert.equal((await incidents({ action: 'SHARE', teamId: teamA, code: 'DISC-01', expectedVersion: 0 })).status, 200);
  let screen = (await h.request('/sessions/tarde/state', null, projector)).body;
  assert.equal(screen.incidentShare.visible, true); assert.equal(screen.incidentShare.teamName, 'Equipo A');
  assert.ok(screen.incidentShare.discussionQuestion); assert.equal(screen.incidentShare.learningPoint, undefined);
  assert.doesNotMatch(JSON.stringify(screen), /privateDescription|Validamos usuario|expectedReasoning|Su ficha/);
  await incidents({ action: 'LEARNING', expectedVersion: 1 });
  screen = (await h.request('/sessions/tarde/state', null, projector)).body;
  assert.ok(screen.incidentShare.learningPoint); assert.deepEqual(screen.incidentShare.preventedIn, ['Descubrimiento']);
  await incidents({ action: 'END_SHARE', expectedVersion: 2 });
  assert.equal((await h.request('/sessions/tarde/state', null, projector)).body.incidentShare.visible, false);
  const discussed = (await h.request('/sessions/tarde/state', null, h.participant)).body.incidents[0];
  assert.equal(discussed.status, 'discussed'); assert.equal(discussed.feedback.expectedChoice, 'b');
  assert.equal((await respond({})).body.error, 'INCIDENT_CLOSED');
  assert.ok(h.db.prepare("SELECT COUNT(*) n FROM phase_actions WHERE data LIKE '%INCIDENT_%'").get().n >= 8);
});
test('Incidentes: la retroalimentación llega en reflexión y las variantes alteran solo al equipo asignado', async t => {
  const h = await harness(t);
  const other = (await h.request('/auth/join', { sessionId: 'tarde', name: 'Equipo B' })).cookie;
  const teamA = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.id;
  const incidents = payload => h.request('/sessions/tarde/incidents', payload, h.presenter);
  const clear = async () => { for (const a of (await h.request('/sessions/tarde/state', null, h.presenter)).body.incidents.assignments.filter(a => a.status === 'assigned')) await incidents({ action: 'UNASSIGN', teamId: a.teamId, code: a.code }); };
  await h.command('START'); await clear();
  for (const cookie of [h.participant, other]) await h.act('discovery', {}, cookie);
  await h.command('ADVANCE'); await clear();
  for (const cookie of [h.participant, other]) await h.act('specification', {}, cookie);
  await h.command('ADVANCE'); await clear();
  for (const cookie of [h.participant, other]) await h.act('architecture', {}, cookie);
  await h.command('ADVANCE'); await clear();
  await incidents({ action: 'ASSIGN', teamId: teamA, code: 'BUILD-03' });
  await incidents({ action: 'REVEAL', teamId: teamA, code: 'BUILD-03' });
  const mismatched = (await h.act('generate')).body.team.project.versions[0];
  assert.equal(mismatched.projectType, 'reservas'); assert.notEqual(mismatched.generatedType, 'reservas');
  assert.deepEqual(mismatched.incidentVariants, ['requirements_mismatch']); assert.doesNotMatch(mismatched.code, /crearReserva\(/);
  const normal = (await h.act('generate', {}, other)).body.team.project.versions[0];
  assert.equal(normal.generatedType, 'reservas'); assert.equal(normal.incidentVariants, undefined);
  assert.equal((await h.request('/sessions/tarde/state', null, h.participant)).body.incidents[0].feedback, undefined);
  await h.command('REFLECT');
  assert.equal((await h.request('/sessions/tarde/state', null, h.participant)).body.incidents[0].feedback.learningPoint, 'Trazabilidad requisitos ↔ resultado.');
  await h.command('CLOSE');
  for (const cookie of [h.participant, other]) { await h.command('REOPEN', { phase: 4, confirm: true }); await h.act('construction', {}, cookie); }
  await h.command('ADVANCE'); await clear();
  await incidents({ action: 'ASSIGN', teamId: teamA, code: 'TEST-01' });
  const scenarios = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.project.versions.at(-1).scenarios;
  assert.ok(scenarios.some(sc => sc.variant === 'assertionless_test' && sc.result === 'PASS'));
  assert.ok((await h.request('/sessions/tarde/state', null, other)).body.team.project.versions.at(-1).scenarios.every(sc => !sc.variant));
  await incidents({ action: 'REVEAL', teamId: teamA, code: 'TEST-01' });
  const share = await incidents({ action: 'SHARE', teamId: teamA, code: 'TEST-01', expectedVersion: 0 });
  assert.equal(share.body.incidents.share.visible, true);
  await h.request('/sessions/tarde/team-admin', { action: 'REMOVE_TEAM', teamId: teamA }, h.presenter);
  const after = (await h.request('/sessions/tarde/state', null, h.presenter)).body.incidents;
  assert.equal(after.share.visible, false); assert.ok(after.assignments.every(a => a.teamId !== teamA));
});
