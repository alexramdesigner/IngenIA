// Prueba de carga del taller: registra equipos, abre conexiones en vivo y recorre las fases midiendo
// latencia, tiempo de difusión a todas las pantallas y consistencia final. Uso:
//   node scripts/load-test.mjs [--teams 50] [--members 6]
//     Levanta un servidor propio con base temporal; no toca data/ingenia.sqlite.
//   LOAD_PASSWORD=… node scripts/load-test.mjs --url https://servidor-de-prueba [--teams 50]
//     Mide una instancia ya desplegada. Solo para una instancia de prueba con base temporal:
//     el script se niega a correr si la sesión ya tiene equipos o no está en espera.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const raw = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const arg = (name, fallback) => raw(name) === undefined ? fallback : Number(raw(name));
const REMOTE = raw('url')?.replace(/\/$/, '');
const TEAMS = arg('teams', 50), MEMBERS = arg('members', 6), PORT = arg('port', 3917);
const password = REMOTE ? process.env.LOAD_PASSWORD : `carga-${randomUUID()}`;
if (REMOTE && !password) { console.error('Define LOAD_PASSWORD con la contraseña de Studio de la instancia de prueba.'); process.exit(2); }
const dir = REMOTE ? null : mkdtempSync(join(tmpdir(), 'ingenia-carga-'));
const server = REMOTE ? null : spawn(process.execPath, ['services/api/server.mjs'], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: join(dir, 'carga.sqlite'), PRESENTER_PASSWORD: password, COOKIE_SECURE: 'false' }, stdio: ['ignore', 'ignore', 'inherit'] });
const origin = REMOTE ?? `http://127.0.0.1:${PORT}`;
const base = `${origin}/api`;
const stats = {};
const record = (name, ms) => (stats[name] ??= []).push(ms);
const pct = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0; };
const errors = [];

async function request(path, data, cookie, label) {
  const started = performance.now();
  const res = await fetch(base + path, { method: data ? 'POST' : 'GET', headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const body = await res.json();
  if (label) record(label, performance.now() - started);
  if (!res.ok) errors.push(`${label ?? path}: ${res.status} ${body.error}`);
  return { status: res.status, body, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
async function pool(items, size, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => { while (queue.length) await work(queue.shift()); }));
}

// Cliente de transmisión en vivo: solo extrae versión y subestado de cada evento.
const clients = [];
function listen(cookie, role, view = '') {
  const client = { role, version: -1, stage: null, events: 0, bytes: 0, maxBytes: 0, seen: new Map(), controller: new AbortController() };
  clients.push(client);
  return new Promise(resolve => {
    fetch(`${base.replace('/api', '/api' + view)}/sessions/tarde/events`, { headers: { Cookie: cookie }, signal: client.controller.signal }).then(async res => {
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ done: true }));
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const message = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const data = message.split('\n').find(line => line.startsWith('data: '));
          if (!data) continue;
          client.events++; client.bytes += data.length; client.maxBytes = Math.max(client.maxBytes, data.length);
          const version = Number(/"version":(\d+)/.exec(data)?.[1] ?? -1);
          client.stage = /"phaseStage":(?:"(\w+)"|null)/.exec(data)?.[1] ?? null;
          if (version > client.version) { client.version = version; client.seen.set(version, performance.now()); }
          resolve();
        }
      }
    }).catch(error => { if (error.name !== 'AbortError') errors.push(`sse: ${error.message}`); resolve(); });
  });
}
// Tiempo hasta que todas las pantallas reciben la versión indicada.
async function fanout(version, since, label, timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (clients.some(c => c.version < version) && performance.now() < deadline) await new Promise(r => setTimeout(r, 5));
  const late = clients.filter(c => c.version < version).length;
  if (late) errors.push(`${label}: ${late} pantallas sin la versión ${version}`);
  record(`difusión · ${label}`, Math.max(...clients.map(c => (c.seen.get(version) ?? [...c.seen.entries()].find(([v]) => v >= version)?.[1] ?? performance.now()) - since)));
}

try {
  for (let i = 0; i < 100; i++) { try { await fetch(`${origin}/healthz`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  const presenter = (await request('/auth/presenter', { password, sessionId: 'tarde' })).cookie;
  if (!presenter) throw new Error('No se pudo ingresar a Studio: revisa LOAD_PASSWORD y la URL.');
  const initial = (await request('/sessions/tarde/state', null, presenter)).body;
  // Protección: nunca recorrer una sesión con datos reales.
  if (initial.status !== 'WAITING' || initial.summary.total > 0) throw new Error(`La sesión «tarde» de ${origin} no está vacía (estado ${initial.status}, ${initial.summary.total} equipos). Usa una instancia de prueba con base temporal.`);
  const token = (await request('/sessions/tarde/projector-access', {}, presenter)).body.token;
  const projector = (await request('/auth/projector', { token })).cookie;

  console.log(`Registrando ${TEAMS * MEMBERS} participantes en ${TEAMS} equipos…`);
  const people = [];
  const registration = performance.now();
  await pool(Array.from({ length: TEAMS * MEMBERS }, (_, i) => i), 50, async i => {
    await request('/team-search', { sessionId: 'tarde', query: `Equipo ${i % TEAMS}` }, null, 'búsqueda de equipo');
    const joined = await request('/auth/join', { sessionId: 'tarde', name: `Equipo ${i % TEAMS}`, fullName: `Persona de prueba ${i}`, email: `carga${i}@ucundinamarca.edu.co` }, null, 'registro');
    if (joined.cookie) people.push({ cookie: joined.cookie, team: i % TEAMS });
  });
  const registrationSeconds = (performance.now() - registration) / 1000;

  console.log('Abriendo conexiones en vivo…');
  await Promise.all([listen(presenter, 'studio', '/studio'), listen(projector, 'proyector', '/projection'), ...people.map(p => listen(p.cookie, 'participante'))]);
  const leaders = [...new Map(people.map(p => [p.team, p])).values()];

  const versionOf = async () => (await request('/sessions/tarde/state', null, presenter)).body.version;
  async function command(action, extra = {}) {
    const started = performance.now();
    const result = await request('/sessions/tarde/phase-command', { action, expectedVersion: await versionOf(), idempotencyKey: randomUUID(), confirm: true, ...extra }, presenter, `comando ${action}`);
    await fanout(result.body.version, started, action);
  }
  const PAYLOADS = {
    discovery: { projectType: 'reservas', user: 'Estudiantes que organizan eventos', problem: 'Las reservas se pierden en chats', features: ['Crear reserva', 'Ver mis reservas', 'Cancelar reserva'], constraint: 'Correo institucional' },
    specification: { stories: ['Como estudiante quiero reservar un auditorio', 'Como estudiante quiero cancelar mi reserva'], criteria: ['La reserva aparece en mi lista', 'No se reserva sin fecha', 'Solo el propietario cancela'], negative: 'Si el espacio está ocupado se avisa y no se guarda' },
    architecture: { architecture: 'client-api', data: 'Reserva con fecha y propietario', accessFlow: 'Inicio de sesión y API que valida', authRule: 'Solo el propietario ve o cancela', justification: 'Datos compartidos y control en servidor' },
    generate: { prompt: 'Crea la app de reservas con API, base de datos y autorización por propietario.' },
    construction: { matches: 'Crea y lista reservas como pedimos', differs: 'No comprueba el propietario por id' },
    verification: { category: 'Seguridad', severity: 'Alta', description: 'Se consulta la reserva de otro usuario', impact: 'Exposición de datos', regressionTest: 'Consultar una reserva ajena responde prohibido' }
  };
  async function teamsSubmit(action) {
    const started = performance.now();
    await Promise.all(leaders.map(async leader => {
      const version = (await request('/sessions/tarde/state', null, leader.cookie)).body.version;
      await request(`/sessions/tarde/actions/${action}`, { ...PAYLOADS[action], expectedVersion: version, idempotencyKey: randomUUID() }, leader.cookie, `entrega ${action}`);
    }));
    record(`ráfaga de ${leaders.length} entregas · ${action}`, performance.now() - started);
  }

  console.log('Recorriendo el taller…');
  await command('START');
  for (const [phase, actions] of [[1, ['discovery']], [2, ['specification']], [3, ['architecture']], [4, ['generate', 'construction']], [5, ['verification']]]) {
    await command('PRACTICE');
    for (const action of actions) await teamsSubmit(action);
    if (phase === 3) {
      const state = (await request('/sessions/tarde/state', null, presenter)).body;
      const started = performance.now();
      for (const a of state.incidents.assignments.filter(a => a.phase === 3)) await request('/sessions/tarde/incidents', { action: 'REVEAL', teamId: a.teamId, code: a.code }, presenter, 'revelar incidente');
      record('revelar todos los incidentes de la fase', performance.now() - started);
      const first = state.incidents.assignments.find(a => a.phase === 3);
      if (first) {
        const shareStarted = performance.now();
        const shared = await request('/sessions/tarde/incidents', { action: 'SHARE', teamId: first.teamId, code: first.code, expectedVersion: state.incidents.share.version }, presenter, 'compartir incidente');
        await request('/sessions/tarde/incidents', { action: 'END_SHARE', expectedVersion: shared.body.incidents.share.version }, presenter, 'finalizar discusión');
      }
    }
    if (phase === 2) { await command('PAUSE'); await command('RESUME'); }
    await command('REFLECT');
    await command('ADVANCE');
  }
  await command('FINISH');

  const final = await versionOf();
  await new Promise(r => setTimeout(r, 300));
  const inconsistent = clients.filter(c => c.version !== final);
  const rss = server ? Number(execFileSync('ps', ['-o', 'rss=', '-p', String(server.pid)]).toString().trim()) / 1024 : null;
  const cpu = server ? execFileSync('ps', ['-o', 'time=', '-p', String(server.pid)]).toString().trim() : null;

  console.log('\n=== Resultado de la prueba de carga ===');
  console.log(`Participantes registrados: ${people.length}/${TEAMS * MEMBERS} en ${registrationSeconds.toFixed(1)} s · conexiones en vivo: ${clients.length}`);
  console.table(Object.fromEntries(Object.entries(stats).map(([name, values]) => [name, { n: values.length, 'p50 ms': Math.round(pct(values, 0.5)), 'p95 ms': Math.round(pct(values, 0.95)), 'máx ms': Math.round(Math.max(...values)) }])));
  const participant = clients.filter(c => c.role === 'participante');
  console.log(`Eventos por participante: ${Math.round(participant.reduce((a, c) => a + c.events, 0) / participant.length)} · datos recibidos por participante: ${(participant.reduce((a, c) => a + c.bytes, 0) / participant.length / 1024).toFixed(0)} KB · mensaje más grande: Studio ${(clients[0].maxBytes / 1024).toFixed(0)} KB, participante ${(Math.max(...participant.map(c => c.maxBytes)) / 1024).toFixed(0)} KB`);
  console.log(`Studio: ${clients[0].events} eventos, ${(clients[0].bytes / 1024 / 1024).toFixed(1)} MB recibidos · proyector: ${clients[1].events} eventos, ${(clients[1].bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(server ? `Servidor: memoria ${rss.toFixed(0)} MB · CPU acumulada ${cpu}` : `Servidor remoto ${origin}: mide memoria y CPU en la instancia (por ejemplo con top o la consola de Lightsail).`);
  console.log(`Consistencia final: ${inconsistent.length ? `${inconsistent.length} pantallas desactualizadas` : `todas las pantallas en la versión ${final}`}`);
  console.log(errors.length ? `Errores (${errors.length}):\n  ${[...new Set(errors)].slice(0, 15).join('\n  ')}` : 'Errores: ninguno');
  process.exitCode = inconsistent.length || errors.length ? 1 : 0;
} finally {
  for (const c of clients) c.controller.abort();
  server?.kill();
  if (dir) rmSync(dir, { recursive: true, force: true });
}
