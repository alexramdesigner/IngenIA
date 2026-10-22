import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../services/api/server.mjs';
import { transition } from '../services/api/domain.mjs';
const password = 'test-only-presenter-password-123456789';
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
    return request(`/sessions/tarde/actions/${action}`, { expectedVersion: state.body.version, idempotencyKey: randomUUID(), ...extra }, cookie);
  };
  return { ...app, request, presenter, participant, command, act, login, base };
}
test('Casos 1–6, 11, 13 y 14: fases y recorrido DEMO sin Internet', async t => {
  const h = await harness(t);
  for (const a of ['generate','audit','fix','publish']) {
    const r = await h.act(a); assert.equal(r.status,403); assert.equal(r.body.error,'PHASE_LOCKED'); assert.equal(r.body.sessionStatus,'WAITING');
  }
  assert.equal((await h.command('START')).status,200);
  assert.equal((await h.act('generate')).body.error,'PHASE_LOCKED');
  assert.equal((await h.act('idea',{prompt:'Una app de tareas para estudiantes sin datos personales'})).status,200);
  assert.equal((await h.act('generate')).status,403);
  const v = (await h.request('/sessions/tarde/state',null,h.presenter)).body.version;
  await h.command('PAUSE');
  assert.equal((await h.act('idea',{prompt:'Una idea que intenta cambiar durante la pausa'})).status,403);
  await h.command('RESUME');
  assert.ok((await h.request('/sessions/tarde/state',null,h.presenter)).body.version>v);
  await h.command('ADVANCE');
  const generated = await h.act('generate'); assert.equal(generated.status,200);
  assert.equal(generated.body.team.project.versions[0].sourceMode,'DEMO');
  for (const a of ['audit','fix','publish']) assert.equal((await h.act(a)).status,403);
  await h.command('ADVANCE');
  assert.equal((await h.act('audit',{justification:'Falta autorizar al propietario en cada acceso.'})).status,200);
  assert.equal((await h.act('fix')).status,403);
  await h.command('ADVANCE');
  assert.equal((await h.act('fix')).status,200);
  assert.equal((await h.act('publish')).status,403);
  await h.command('ADVANCE');
  assert.equal((await h.act('publish',{verdict:'GO',checklist:true,justification:'Solo presentación privada de un fixture educativo.'})).status,200);
  await h.command('FINISH',{confirm:true});
  assert.equal((await h.act('publish')).status,403);
  assert.equal((await h.request('/sessions/tarde/report',null,h.participant)).body.team.project.verdict,'GO');
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
  assert.equal(reconnected.body.activePhase,2); assert.equal(reconnected.body.permissions.idea,false);
  assert.equal(reconnected.body.permissions.generate,false);
  assert.equal(reconnected.body.phaseStage,'THEORY');
  assert.equal((await h.request('/sessions/tarde/actions/generate',{expectedVersion:1,idempotencyKey:randomUUID()},h.participant)).body.error,'PHASE_LOCKED');
  await h.command('PRACTICE');
  assert.equal((await h.request('/sessions/tarde/actions/generate',{expectedVersion:1,idempotencyKey:randomUUID()},h.participant)).body.error,'VERSION_CONFLICT');
});
test('Caso 12: resultado tardío rechazado tras cerrar o reabrir la fase', async t => {
  const h = await harness(t);
  await h.command('START'); await h.act('idea',{prompt:'Un prototipo educativo de tareas para estudiantes'}); await h.command('ADVANCE');
  const version = (await h.request('/sessions/tarde/state',null,h.participant)).body.version;
  await h.command('ADVANCE',{confirm:true});
  const late = await h.request('/sessions/tarde/actions/generate',{expectedVersion:version,idempotencyKey:randomUUID()},h.participant);
  assert.equal(late.body.error,'PHASE_LOCKED');
  await h.command('REOPEN',{phase:2,confirm:true});
  assert.equal((await h.request('/sessions/tarde/actions/generate',{expectedVersion:version,idempotencyKey:randomUUID()},h.participant)).body.error,'VERSION_CONFLICT');
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).body.team.project.versions.length,0);
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
  assert.equal((await h.request('/sessions/tarde/actions/idea',{idempotencyKey:'a',prompt:'Intento de editar desde el proyector'},projector)).status,403);
  assert.equal((await h.request('/sessions/tarde/phase-command',{action:'START'},projector)).status,403);
});
test('Transacciones: precondiciones, idempotencia de entregas e invalidación al retroceder', async t => {
  const h=await harness(t);
  await h.command('START');
  assert.equal((await h.command('ADVANCE')).body.error,'INCOMPLETE_TEAMS');
  await h.command('ADVANCE',{confirm:true});
  assert.equal((await h.act('generate')).body.error,'IDEA_REQUIRED');
  await h.command('REOPEN',{phase:1,confirm:true});
  await h.act('idea',{prompt:'Una app de tareas para un equipo de estudiantes'});
  await h.command('ADVANCE');
  const version=(await h.request('/sessions/tarde/state',null,h.participant)).body.version;
  const b={expectedVersion:version,idempotencyKey:randomUUID()};
  await h.request('/sessions/tarde/actions/generate',b,h.participant);
  await h.request('/sessions/tarde/actions/generate',b,h.participant);
  assert.equal((await h.request('/sessions/tarde/state',null,h.participant)).body.team.project.versions.length,1);
  await h.command('REOPEN',{phase:1,confirm:true});
  await h.act('idea',{prompt:'Otra idea para el equipo; requiere nueva generación'});
  await h.command('REOPEN',{phase:3,confirm:true});
  assert.equal((await h.act('audit',{justification:'Un intento de auditar un prototipo anterior'})).body.error,'PROTOTYPE_REQUIRED');
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
  await h.act('idea',{prompt:'Una idea compartida por los seis integrantes del equipo'},member);
  const other=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  assert.equal(other.team.project.prompt,'Una idea compartida por los seis integrantes del equipo');
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
  await h.command('START'); await h.act('idea',{prompt:'Idea original que debe conservarse al recuperar acceso'});
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
  assert.equal((await h.act('idea',{prompt:'Intento de editar mientras el taller está pausado'},paused.cookie)).status,403);
  await h.command('FINISH',{confirm:true});
  const closed=await h.request('/auth/join',registration);assert.equal(closed.status,200);
  assert.equal((await h.request('/sessions/tarde/state',null,closed.cookie)).body.status,'FINISHED');
  assert.equal((await h.act('idea',{prompt:'Intento de editar una vez terminada la sesión'},closed.cookie)).status,403);
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

test('Cinco fases: explicación bloqueada, práctica explícita, pausa y cronómetro',async t=>{
 const h=await harness(t);
 const command=async(action,extra={})=>{
  const s=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
  return h.request('/sessions/tarde/phase-command',{action,expectedVersion:s.version,idempotencyKey:randomUUID(),...extra},h.presenter);
 };
 const actions=['idea','generate','audit','fix','publish'];
 for(let phase=1;phase<=5;phase++){
  const opened=await command(phase===1?'START':'ADVANCE',{confirm:true});
  assert.equal(opened.body.phaseStage,'THEORY');assert.equal(opened.body.deadline,null);assert.equal(opened.body.activePhase,phase);
  let student=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  assert.equal(Object.values(student.permissions).some(Boolean),false);
  assert.equal((await h.act(actions[phase-1])).body.error,'PHASE_LOCKED');
  assert.equal((await command('EXTEND')).status,409);
  await command('PAUSE');assert.equal((await command('PRACTICE')).status,409);
  assert.equal((await command('RESUME')).body.deadline,null);
  const practice=await command('PRACTICE',{seconds:60});
  assert.equal(practice.status,200);assert.equal(practice.body.phaseStage,'PRACTICE');assert.ok(practice.body.deadline>Date.now());
  student=(await h.request('/sessions/tarde/state',null,h.participant)).body;
  assert.equal(student.permissions[actions[phase-1]],true);
  assert.equal((await command('PRACTICE')).status,409);
 }
 const reopened=await command('REOPEN',{phase:2,confirm:true});assert.equal(reopened.body.phaseStage,'THEORY');
 const state=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
 assert.equal((await h.request('/sessions/tarde/phase-command',{action:'PRACTICE',expectedVersion:state.version,idempotencyKey:randomUUID()},h.participant)).status,403);
});
test('Notas del conferencista: cinco fases, privacidad, sesión, versiones y persistencia',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ingenia-speaker-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const database=join(dir,'test.sqlite');const h=await harness(t,database);
 const path='/sessions/tarde/phase-notes';
 const access=await h.request('/sessions/tarde/projector-access',{},h.presenter);
 const projector=(await h.request('/auth/projector',{token:access.body.token})).cookie;
 for(let phase=1;phase<=5;phase++){
  const result=await h.request(path,{phase,content:`Puntos privados fase ${phase}`,expectedVersion:0},h.presenter);
  assert.equal(result.status,200);assert.equal(result.body.note.version,1);
 }
 const presenter=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
 assert.equal(presenter.version,0);assert.equal(Object.keys(presenter.phaseNotes).length,5);
 for(const cookie of [h.participant,projector]){
  assert.equal((await h.request('/sessions/tarde/state',null,cookie)).body.phaseNotes,undefined);
  assert.equal((await h.request(path,{phase:1,content:'intento',expectedVersion:1},cookie)).status,403);
 }
 assert.equal((await h.request('/sessions/noche/phase-notes',{phase:1,content:'intento',expectedVersion:0},h.presenter)).status,403);
 const night=await h.login('noche');assert.deepEqual((await h.request('/sessions/noche/state',null,night)).body.phaseNotes,{});
 for(const phase of [0,6,'1'])assert.equal((await h.request(path,{phase,content:'inválido',expectedVersion:0},h.presenter)).status,400);
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
 await h.act('idea',{prompt:'Idea del equipo para compartir con todos en el auditorio'});
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
 await h.act('idea',{prompt:'La idea se modificó mientras el equipo estaba hablando'});
 assert.match((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.pages[0],/Idea del equipo/);
 assert.match((await review('SHOW',{teamId:team.id})).body.teamReview.pages[0],/idea se modificó/);
 await h.command('ADVANCE');assert.equal((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.visible,false);
});
test('Revisión: cinco fases, paginación, SSE, pausa y cierre sin reiniciar el taller',async t=>{
 const h=await harness(t),path='/sessions/tarde/team-review';
 const team=(await h.request('/sessions/tarde/state',null,h.participant)).body.team;
 const access=await h.request('/sessions/tarde/projector-access',{},h.presenter);
 const projector=(await h.request('/auth/projector',{token:access.body.token})).cookie;
 const show=async()=>{
  const state=(await h.request('/sessions/tarde/state',null,h.presenter)).body;
  return h.request(path,{action:'SHOW',teamId:team.id,expectedVersion:state.teamReview.version},h.presenter);
 };
 await h.command('START');await h.act('idea',{prompt:'Idea larga del equipo. '.repeat(180)});
 const abort=new AbortController();
 const response=await fetch(h.base+'/api/projection/sessions/tarde/events',{headers:{Cookie:projector},signal:abort.signal});
 const reader=response.body.getReader();await reader.read();
 let shown=await show();assert.equal(shown.body.teamReview.phase,1);assert.ok(shown.body.teamReview.pages.length>1);
 const event=new TextDecoder().decode((await reader.read()).value);assert.match(event,/team.review.updated/);abort.abort();
 let paged=await h.request(path,{action:'PAGE',page:1,expectedVersion:shown.body.teamReview.version},h.presenter);
 assert.equal(paged.body.teamReview.page,1);
 await h.command('PAUSE');assert.equal((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.visible,true);await h.command('RESUME');
 await h.command('ADVANCE');await h.act('generate');shown=await show();assert.match(shown.body.teamReview.pages.join(''),/FICTICIA_NO_USAR/);
 await h.command('ADVANCE');await h.act('audit',{justification:'Es necesario autorizar cada acceso al recurso del usuario.'});shown=await show();assert.match(shown.body.teamReview.pages.join(''),/autorizar cada acceso/);
 await h.command('ADVANCE');await h.act('fix');shown=await show();assert.match(shown.body.teamReview.pages.join(''),/record.ownerId/);
 await h.command('ADVANCE');await h.act('publish',{verdict:'NO_GO',checklist:true,justification:'Este prototipo solo se utiliza como demostración educativa.'});shown=await show();assert.match(shown.body.teamReview.pages.join(''),/NO_GO/);assert.match(shown.body.teamReview.pages.join(''),/demostración educativa/);
 await h.command('FINISH',{confirm:true});assert.equal((await h.request('/sessions/tarde/state',null,projector)).body.teamReview.visible,false);
 assert.ok(h.db.prepare("SELECT COUNT(*) n FROM phase_actions WHERE data LIKE '%TEAM_REVIEW_%'").get().n>=6);
});
test('Ciclo de mejora: desde Corregir se vuelve a Generar con prompt ajustado hasta tres iteraciones', async t => {
  const h = await harness(t);
  const cycle = async () => {
    assert.equal((await h.act('generate')).status, 200); await h.command('ADVANCE');
    assert.equal((await h.act('audit', { justification: 'Credencial expuesta y falta autorización.' })).status, 200); await h.command('ADVANCE');
    assert.equal((await h.act('fix')).status, 200);
  };
  await h.command('START'); await h.act('idea', { prompt: 'Una app de tareas para estudiantes sin datos personales' }); await h.command('ADVANCE');
  assert.equal((await h.command('ITERATE', { confirm: true })).body.error, 'INVALID_TRANSITION');
  await cycle();
  assert.equal((await h.command('ITERATE')).body.error, 'CONFIRMATION_REQUIRED');
  const second = await h.command('ITERATE', { confirm: true });
  assert.equal(second.status, 200);
  assert.equal(second.body.activePhase, 2); assert.equal(second.body.phaseStage, 'PRACTICE'); assert.equal(second.body.iteration, 2);
  let project = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.project;
  assert.deepEqual(project.submissions, { 1: true }); assert.equal(project.fixed, undefined); assert.equal(project.versions.length, 2);
  assert.equal((await h.act('audit', { justification: 'Antes de generar de nuevo.' })).body.error, 'PHASE_LOCKED');
  assert.equal((await h.act('generate', { prompt: 'corto' })).body.error, 'PROMPT_LENGTH');
  assert.equal((await h.act('generate', { prompt: 'Una app de tareas que autoriza en servidor y no guarda datos personales' })).status, 200);
  project = (await h.request('/sessions/tarde/state', null, h.participant)).body.team.project;
  assert.equal(project.prompt, 'Una app de tareas que autoriza en servidor y no guarda datos personales');
  assert.equal(project.versions.at(-1).iteration, 2);
  await h.command('ADVANCE'); await h.act('audit', { justification: 'Revisión de la segunda versión.' }); await h.command('ADVANCE'); await h.act('fix');
  assert.equal((await h.command('ITERATE', { confirm: true })).body.iteration, 3);
  await cycle();
  assert.equal((await h.command('ITERATE', { confirm: true })).body.error, 'ITERATION_LIMIT');
  assert.equal((await h.command('ADVANCE')).body.activePhase, 5);
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
