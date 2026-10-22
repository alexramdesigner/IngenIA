import http from 'node:http';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { reviewSnapshot } from './team-review.mjs';
import { openStore, transaction } from './store.mjs';
import { ApiError, transition, requireActivePhase, permissions } from './domain.mjs';
import { applyDemo, startIteration, reviewDeliverable, deliverableText, applyIncidentVariant, removeIncidentVariant } from './deliverables.mjs';
import { INCIDENT_DEFAULTS, incidentByCode, planAssignments, participantIncidents, presenterIncident, projectorIncident, catalogForPhase } from './incidents.mjs';
import { TEAM_ROLES } from '../../packages/shared/team-roles.mjs';
import { MAX_TEAM_MEMBERS, teamName, teamKey } from '../../packages/shared/teams.mjs';
import { ACTION_PHASE, PHASE_COUNT } from '../../packages/shared/phases.mjs';
import { isDelivered } from '../../packages/shared/projects.mjs';
const delivered = project => Object.keys(project?.deliverables ?? {}).map(Number).filter(phase => isDelivered(project.deliverables[phase])).sort((a, b) => a - b);
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const text = (value, max = 100) => typeof value === 'string' && value.length > 0 && value.length <= max;
export function createApp(options = {}) {
  const password = options.password ?? process.env.PRESENTER_PASSWORD;
  if (!password || password.length < 12) throw new Error('Ejecuta npm run setup: PRESENTER_PASSWORD requiere al menos 12 caracteres.');
  const db = openStore(options.database ?? process.env.DATABASE_PATH ?? './data/ingenia.sqlite');
  const ttl = Number(process.env.TOKEN_TTL_SECONDS ?? 28800) * 1000;
  if (!Number.isFinite(ttl) || ttl < 60000 || ttl > 86400000) throw new Error('TOKEN_TTL_SECONDS debe estar entre 60 y 86400.');
  const secure = process.env.COOKIE_SECURE === 'true';
  const clients = new Set();
  const rates = new Map();
  const limit = (name, fallback) => { const value = Number(options.rateLimits?.[name] ?? process.env[`RATE_LIMIT_${name.toUpperCase()}_PER_MIN`] ?? fallback); return Number.isFinite(value) && value > 0 ? value : fallback; };
  const limits = { ip: limit('ip', 6000), client: limit('client', 600), credentials: limit('credentials', 20) };
  const trustProxy = (options.trustProxy ?? process.env.TRUST_PROXY) === true || process.env.TRUST_PROXY === 'true';
  // Detrás de un proxy de confianza la IP real llega en X-Forwarded-For; nunca se confía en ella sin TRUST_PROXY.
  const clientIp = req => (trustProxy && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress;
  function limited(key, max, now = Date.now()) {
    const bucket = rates.get(key) ?? { count: 0, until: now + 60000 };
    if (bucket.until <= now) { bucket.count = 0; bucket.until = now + 60000; }
    bucket.count++; rates.set(key, bucket);
    return bucket.count > max;
  }
  const getSession = id => {
    const row = db.prepare('SELECT data FROM sessions WHERE id=?').get(id);
    if (!row) throw new ApiError(404, 'SESSION_NOT_FOUND');
    return JSON.parse(row.data);
  };
  function registrationSession(body) {
    let row;
    if (body.sessionId !== undefined) {
      if (!text(body.sessionId,40)) throw new ApiError(400,'INVALID_JOIN');
      row = db.prepare('SELECT id,join_code,statistics_code FROM sessions WHERE id=?').get(body.sessionId);
    } else if (text(body.code,40)) {
      // Compatibilidad con clientes previos: el formulario actual solo envía sessionId.
      row = db.prepare('SELECT id,join_code,statistics_code FROM sessions WHERE join_code=?').get(body.code.trim().toUpperCase());
    }
    if (!row || (body.code !== undefined && (!text(body.code,40) || body.code.trim().toUpperCase() !== row.join_code))) throw new ApiError(400,'INVALID_JOIN');
    return row;
  }
  function tokenFor(req) {
    const cookies = Object.fromEntries((req.headers.cookie ?? '').split(';').map(c => c.trim().split('=')));
    const context = req.url.startsWith('/api/studio/') ? 'PRESENTER' : req.url.startsWith('/api/projection/') ? 'PROJECTOR' : null;
    const names = context === 'PRESENTER' ? ['ingenia_presenter'] : context === 'PROJECTOR' ? ['ingenia_projector'] : ['ingenia', 'ingenia_presenter', 'ingenia_projector'];
    for (const name of names) {
      const token = cookies[name];
      if (!token) continue;
      const actor = db.prepare('SELECT i.* FROM tokens t JOIN identities i ON i.id=t.identity_id WHERE t.hash=? AND t.expires>?').get(hash(token), Date.now());
      if (actor && (!context || actor.role === context)) return { token, actor, name };
    }
    throw new ApiError(401, 'UNAUTHENTICATED');
  }
  function authenticate(req) { return tokenFor(req).actor; }
  function authorize(actor, id, role) {
    if (actor.session_id !== id || (role && actor.role !== role)) throw new ApiError(403, 'FORBIDDEN');
  }
  const teamReview=id=>{
    const row=db.prepare('SELECT data FROM team_reviews WHERE session_id=?').get(id);
    return row?JSON.parse(row.data):{visible:false,version:0};
  };
  // Incidentes: asignaciones por equipo y la intervención que se comparte en el auditorio.
  const incidentShare = id => {
    const row = db.prepare('SELECT data FROM incident_shares WHERE session_id=?').get(id);
    return row ? JSON.parse(row.data) : { visible: false, version: 0 };
  };
  const saveShare = (id, data) => db.prepare('INSERT INTO incident_shares VALUES (?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data').run(id, JSON.stringify(data));
  const assignments = (id, teamId) => db.prepare(`SELECT * FROM incident_assignments WHERE session_id=?${teamId ? ' AND team_id=?' : ''} ORDER BY phase, assigned_at`).all(...(teamId ? [id, teamId] : [id]))
    .map(r => ({ teamId: r.team_id, code: r.code, phase: r.phase, status: r.status, origin: r.origin, assignedAt: r.assigned_at, revealedAt: r.revealed_at, response: r.response ? JSON.parse(r.response) : null, resolvedAt: r.resolved_at, sharedAt: r.shared_at, discussedAt: r.discussed_at }));
  function assignIncident(id, teamId, code, phase, origin) {
    db.prepare('INSERT INTO incident_assignments(session_id,team_id,code,phase,status,origin,assigned_at) VALUES (?,?,?,?,?,?,?)').run(id, teamId, code, phase, 'assigned', origin, Date.now());
    // Las variantes que dependen de un resultado ya generado se aplican al asignar.
    const variant = incidentByCode(code).fixtureVariant;
    if (variant === 'assertionless_test') {
      const row = db.prepare('SELECT data FROM teams WHERE id=?').get(teamId), team = JSON.parse(row.data);
      team.project = applyIncidentVariant(team.project, variant);
      db.prepare('UPDATE teams SET data=? WHERE id=?').run(JSON.stringify(team), teamId);
    }
  }
  function autoAssign(id, phase) {
    const config = { ...INCIDENT_DEFAULTS, ...(getSession(id).incidentConfig ?? {}) };
    const teamIds = db.prepare('SELECT id FROM teams WHERE session_id=? ORDER BY id').all(id).map(r => r.id);
    for (const item of planAssignments(id, teamIds, phase, assignments(id), config)) assignIncident(id, item.teamId, item.code, item.phase, 'auto');
  }
  // Instantánea compartida: lo común a todas las vistas se lee una sola vez por difusión;
  // cada rol agrega después únicamente sus datos personales.
  function snapshot(id) {
    const s = getSession(id);
    const teams = db.prepare('SELECT data FROM teams WHERE session_id=?').all(id).map(row => JSON.parse(row.data));
    const counts = new Map(db.prepare("SELECT team_id, COUNT(*) AS n FROM identities WHERE session_id=? AND role='PARTICIPANT' GROUP BY team_id").all(id).map(r => [r.team_id, r.n]));
    const codes = db.prepare('SELECT statistics_code, join_code FROM sessions WHERE id=?').get(id);
    // Conectados: participantes distintos con una transmisión en vivo abierta en esta sesión.
    const online = new Set([...clients].filter(c => c.actor.session_id === id && c.actor.role === 'PARTICIPANT').map(c => c.actor.id)).size;
    const memberCount = teamId => counts.get(teamId) ?? 0;
    const summary = { total: teams.length, participants: [...counts.values()].reduce((a, n) => a + n, 0), online, completed: teams.filter(t => isDelivered(t.project.deliverables?.[s.activePhase])).length };
    const cache = new Map(), once = (key, compute) => cache.has(key) ? cache.get(key) : (cache.set(key, compute()), cache.get(key));
    return { id, s, teams, codes, summary, memberCount, once, review: teamReview(id), share: incidentShare(id), incidents: assignments(id) };
  }
  function state(id, actor, snap = snapshot(id)) {
    const { s, teams, summary, memberCount, once, share } = snap;
    const result = { ...s, statisticsCode: snap.codes.statistics_code, serverTime: Date.now(), permissions: permissions(s, actor.role), role: actor.role, summary };
    if (['PRESENTER','PROJECTOR'].includes(actor.role)) result.teamReview = snap.review;
    if (actor.role === 'PROJECTOR') {
      result.incidentShare = once('projectorIncident', () => projectorIncident(share, share.visible ? teams.find(t => t.id === share.teamId)?.name : null));
      // Auditorio: solo nombre del equipo y fases entregadas, sin integrantes ni contenido.
      result.leaderboard = once('leaderboard', () => teams.map(t => ({ name: t.name, completed: delivered(t.project).length })).sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name, 'es')));
    }
    if (actor.role === 'PRESENTER') {
      result.joinCode = snap.codes.join_code;
      result.phaseNotes = once('phaseNotes', () => Object.fromEntries(db.prepare('SELECT phase,content,version,updated_at AS updatedAt FROM presenter_phase_notes WHERE session_id=?').all(id).map(note => [note.phase, note])));
      result.incidents = once('presenterIncidents', () => ({ share, catalog: catalogForPhase(s.activePhase), assignments: snap.incidents.map(a => ({ ...presenterIncident(a), teamName: teams.find(t => t.id === a.teamId)?.name ?? '' })) }));
      result.teams = once('presenterTeams', () => {
        const members = Map.groupBy(db.prepare('SELECT identity_id AS id,team_id AS teamId,full_name AS fullName,email,team_role AS teamRole FROM participant_profiles WHERE session_id=? ORDER BY rowid').all(id), m => m.teamId);
        return teams.map(t => ({ id: t.id, name: t.name, memberCount: memberCount(t.id), maxMembers: MAX_TEAM_MEMBERS, members: (members.get(t.id) ?? []).map(({ teamId, ...member }) => member), completed: delivered(t.project),
          // Entrega de la fase activa para revisarla desde Studio.
          current: s.activePhase ? { status: t.project.deliverables?.[s.activePhase]?.status ?? null, review: t.project.deliverables?.[s.activePhase]?.review ?? null, text: deliverableText(t.project, s.activePhase) } : null,
          legacy: Boolean(t.legacyProject?.needsReconciliation) }));
      });
    }
    if (actor.role === 'PARTICIPANT') {
      const team = teams.find(t => t.id === actor.team_id);
      if (!team) throw new ApiError(401, 'UNAUTHENTICATED');
      result.profile = db.prepare('SELECT full_name AS fullName,email,team_role AS teamRole FROM participant_profiles WHERE identity_id=?').get(actor.id);
      result.team = { ...team, memberCount: memberCount(team.id), maxMembers: MAX_TEAM_MEMBERS };
      const note = db.prepare('SELECT content,version,updated_at AS updatedAt FROM participant_notes WHERE identity_id=? AND session_id=?').get(actor.id, id);
      result.note = note ?? { content: '', version: 0, updatedAt: null };
      result.incidents = once(`incidents:${team.id}`, () => participantIncidents(snap.incidents.filter(a => a.teamId === team.id), s));
    }
    return result;
  }
  const cookie = (token, name) => `${name}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(ttl / 1000)}${secure ? '; Secure' : ''}`;
  function issue(res, identity) {
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM tokens WHERE expires<=?').run(Date.now());
    db.prepare('INSERT INTO tokens VALUES (?,?,?)').run(hash(token), identity.id, Date.now() + ttl);
    const role = db.prepare('SELECT role FROM identities WHERE id=?').get(identity.id).role;
    const name = ({ PRESENTER: 'ingenia_presenter', PROJECTOR: 'ingenia_projector', PARTICIPANT: 'ingenia' })[role];
    res.setHeader('Set-Cookie', cookie(token, name));
  }
  // audience: rol ('PRESENTER', 'PROJECTOR') o función que decide qué conexiones reciben el cambio.
  function emit(id, type, audience) {
    const snap = snapshot(id);
    db.prepare('INSERT INTO events(session_id,type,version,timestamp) VALUES (?,?,?,?)').run(id, type, snap.s.version, Date.now());
    const wants = typeof audience === 'function' ? audience : c => !audience || c.actor.role === audience;
    for (const c of clients) if (c.actor.session_id === id && wants(c)) {
      if (c.expires <= Date.now()) { c.res.end(); clients.delete(c); continue; }
      try { c.res.write(`event: ${type}\ndata: ${JSON.stringify(state(id, c.actor, snap))}\n\n`); }
      catch { c.res.end(); clients.delete(c); }
    }
  }
  // Cambios de un equipo: solo lo reciben sus integrantes, Studio y el proyector.
  const teamAudience = teamId => c => c.actor.role !== 'PARTICIPANT' || c.actor.team_id === teamId;
  // Ráfagas de entregas: el equipo recibe su cambio al instante; Studio y proyector, una sola
  // actualización agrupada cada 250 ms en lugar de una por equipo.
  const coalesced = new Map();
  function emitStaff(id, type) {
    const key = `${id}:${type}`;
    if (coalesced.has(key)) return;
    coalesced.set(key, setTimeout(() => { coalesced.delete(key); emit(id, type, c => c.actor.role !== 'PARTICIPANT'); }, 250));
  }
  function emitTeamProgress(id, teamId, type = 'team.progress') {
    emit(id, type, c => c.actor.role === 'PARTICIPANT' && c.actor.team_id === teamId);
    emitStaff(id, type);
  }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new ApiError(413, 'BODY_TOO_LARGE'); chunks.push(chunk); }
    try { const data = JSON.parse(Buffer.concat(chunks).toString() || '{}'); if (!data || Array.isArray(data) || typeof data !== 'object') throw 0; return data; }
    catch { throw new ApiError(400, 'INVALID_JSON'); }
  }
  function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    if (options.logRequests !== false) res.on('finish', () => console.log(JSON.stringify({ level: 'info', requestId, method: req.method, status: res.statusCode, durationMs: Date.now() - startedAt }))); 
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-src 'none'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname.replace(/^\/api\/(studio|projection)(?=\/)/, '/api');
      if (path === '/healthz') { db.prepare('SELECT 1').get(); return json(res, 200, { status: 'ok', mode: 'DEMO' }); }
      // En el auditorio cientos de celulares comparten la IP pública del Wi-Fi: el tope por IP es amplio,
      // cada acceso tiene su propio límite y solo las credenciales de Studio/proyector son estrictas.
      const ip = clientIp(req);
      const client = req.headers.cookie ? hash(req.headers.cookie).slice(0, 32) : null;
      if (limited(`ip:${ip}`, limits.ip) || (client && limited(`client:${client}`, limits.client)) || (['/api/auth/presenter', '/api/auth/projector'].includes(path) && limited(`credentials:${ip}`, limits.credentials))) throw new ApiError(429, 'RATE_LIMITED');
      if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin) {
          let host; try { host = new URL(origin).host; } catch { throw new ApiError(403, 'ORIGIN_REJECTED'); }
          if (host !== req.headers.host) throw new ApiError(403, 'ORIGIN_REJECTED');
        }
        if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'ORIGIN_REJECTED');
        if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'JSON_REQUIRED');
      }
      if (path === '/api/auth/presenter' && req.method === 'POST') {
        const b = await body(req);
        if (typeof b.password !== 'string' || !timingSafeEqual(Buffer.from(hash(b.password)), Buffer.from(hash(password)))) throw new ApiError(401, 'INVALID_CREDENTIALS');
        getSession(b.sessionId);
        const identity = { id: randomUUID(), session_id: b.sessionId, role: 'PRESENTER' };
        db.prepare('INSERT INTO identities VALUES (?,?,?,NULL)').run(identity.id, identity.session_id, identity.role);
        issue(res, identity); return json(res, 200, { sessionId: identity.session_id });
      }
      if (path === '/api/team-search' && req.method === 'POST') {
        const b = await body(req);
        if (typeof b.query !== 'string' || b.query.length > 60) throw new ApiError(400,'INVALID_JOIN');
        let sessionId = null;
        if (b.sessionId !== undefined || b.code !== undefined) {
          const row = registrationSession(b);
          if (getSession(row.id).status === 'FINISHED') throw new ApiError(409,'SESSION_FINISHED');
          sessionId = row.id;
        }
        const query = teamKey(b.query);
        if (!query) return json(res,200,{teams:[],maxMembers:MAX_TEAM_MEMBERS});
        const rows = db.prepare(`SELECT t.id,t.name,n.name_key,n.session_id AS sessionId,s.data AS sessionData,COUNT(i.id) AS memberCount FROM team_names n
          JOIN teams t ON t.id=n.team_id JOIN sessions s ON s.id=n.session_id LEFT JOIN identities i ON i.team_id=t.id AND i.role='PARTICIPANT'
          WHERE (? IS NULL OR n.session_id=?) AND json_extract(s.data,'$.status')!='FINISHED'
          GROUP BY t.id,n.name_key ORDER BY t.name,n.session_id`).all(sessionId,sessionId);
        const teams = rows.filter(t=>t.name_key.includes(query)).sort((a,b)=>Number(b.name_key.startsWith(query))-Number(a.name_key.startsWith(query))).slice(0,8).map(({id,name,sessionId,sessionData,memberCount})=>({id,name,sessionId,sessionTitle:JSON.parse(sessionData).title,memberCount,full:memberCount>=MAX_TEAM_MEMBERS}));
        return json(res,200,{teams,maxMembers:MAX_TEAM_MEMBERS});
      }
      if (path === '/api/auth/join' && req.method === 'POST') {
        const b = await body(req);
        if (!text(b.name, 60) || !teamName(b.name)) throw new ApiError(400, 'INVALID_JOIN');
        const fullName = typeof b.fullName === 'string' ? b.fullName.trim().replace(/\s+/gu,' ') : '';
        const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
        if(fullName.length<3 || fullName.length>120 || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400,'IDENTITY_REQUIRED');
        const row = registrationSession(b);
        let existingActor;
        try { existingActor = authenticate(req); } catch {}
        const result = transaction(db, () => {
          function complete(result) {
            db.prepare('DELETE FROM tokens WHERE identity_id=?').run(result.id);
            if(existingActor?.role === 'PARTICIPANT' && existingActor.id !== result.id) db.prepare('DELETE FROM tokens WHERE identity_id=?').run(existingActor.id);
            issue(res,{id:result.id});
            return result;
          }
          const duplicate = db.prepare('SELECT p.identity_id,t.id AS teamId,t.name FROM participant_profiles p JOIN teams t ON t.id=p.team_id WHERE p.session_id=? AND p.email=?').get(row.id,email);
          if(duplicate) {
            if(teamKey(b.name) !== teamKey(duplicate.name) || (b.teamId !== undefined && b.teamId !== duplicate.teamId)) throw new ApiError(409,'TEAM_CHANGE_NOT_ALLOWED');
            return complete({id:duplicate.identity_id,teamId:duplicate.teamId,name:duplicate.name,reused:true});
          }
          if (getSession(row.id).status === 'FINISHED') throw new ApiError(409, 'SESSION_FINISHED');
          const key = teamKey(b.name);
          const existing = db.prepare('SELECT t.id,t.name FROM team_names n JOIN teams t ON t.id=n.team_id WHERE n.session_id=? AND n.name_key=?').get(row.id,key);
          if (b.teamId !== undefined && (!existing || b.teamId !== existing.id)) throw new ApiError(409,'TEAM_SELECTION_CHANGED');
          if (existingActor?.role === 'PARTICIPANT' && existingActor.session_id === row.id) {
            if (existingActor.team_id !== existing?.id) throw new ApiError(409,'ALREADY_IN_TEAM');
            const profile=db.prepare('SELECT * FROM participant_profiles WHERE identity_id=?').get(existingActor.id);
            if(profile.email && profile.email !== email) throw new ApiError(409,'IDENTITY_MISMATCH');
            db.prepare('UPDATE participant_profiles SET full_name=?,email=? WHERE identity_id=?').run(fullName,email,existingActor.id);
            return complete({id:existingActor.id,teamId:existing.id,name:existing.name,reused:true});
          }
          let teamId = existing?.id;
          const name = existing?.name ?? teamName(b.name);
          if (teamId) {
            const members = db.prepare("SELECT COUNT(*) n FROM identities WHERE team_id=? AND role='PARTICIPANT'").get(teamId).n;
            if (members >= MAX_TEAM_MEMBERS) throw new ApiError(409,'TEAM_FULL',{maxMembers:MAX_TEAM_MEMBERS});
          } else {
            if (db.prepare('SELECT COUNT(*) AS n FROM teams WHERE session_id=?').get(row.id).n >= 200) throw new ApiError(409, 'SESSION_FULL');
            teamId = randomUUID();
            db.prepare('INSERT INTO teams VALUES (?,?,?,?)').run(teamId,row.id,name,JSON.stringify({id:teamId,name,project:{}}));
            db.prepare('INSERT INTO team_names VALUES (?,?,?)').run(row.id,key,teamId);
          }
          const id = randomUUID();
          db.prepare('INSERT INTO identities VALUES (?,?,?,?)').run(id,row.id,'PARTICIPANT',teamId);
          const used = db.prepare('SELECT team_role FROM participant_profiles WHERE team_id=?').all(teamId).map(r=>r.team_role);
          const teamRole = TEAM_ROLES.find(role=>!used.includes(role));
          if(!teamRole) throw new ApiError(409,'TEAM_FULL');
          db.prepare('INSERT INTO participant_profiles VALUES (?,?,?,?,?,?)').run(id,row.id,teamId,fullName,email,teamRole);
          return complete({id,teamId,name,reused:false});
        });
        for(const client of clients) if(client.actor.id === result.id || (existingActor?.role === 'PARTICIPANT' && client.actor.id === existingActor.id)) { client.res.end(); clients.delete(client); }
        emitTeamProgress(row.id, result.teamId);
        return json(res,result.reused ? 200 : 201,{sessionId:row.id,statisticsCode:row.statistics_code,teamId:result.teamId,teamName:result.name,maxMembers:MAX_TEAM_MEMBERS});
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        authenticate(req);
        const { token, name } = tokenFor(req);
        db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(token));
        for (const c of clients) if (c.tokenHash === hash(token)) { c.res.end(); clients.delete(c); }
        res.setHeader('Set-Cookie', `${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
        return json(res, 200, { ok: true });
      }
      if (path === '/api/notes' && req.method === 'POST') {
        const actor = authenticate(req);
        authorize(actor,actor.session_id,'PARTICIPANT');
        const b = await body(req);
        if (typeof b.content !== 'string' || b.content.length > 3000 || !Number.isInteger(b.expectedVersion)) throw new ApiError(400,'INVALID_NOTE');
        const note = transaction(db,()=>{
          const s = getSession(actor.session_id);
          if (['PAUSED','FINISHED'].includes(s.status)) throw new ApiError(403,'NOTES_READ_ONLY');
          const old = db.prepare('SELECT version FROM participant_notes WHERE identity_id=?').get(actor.id);
          if ((old?.version ?? 0) !== b.expectedVersion) throw new ApiError(409,'NOTE_VERSION_CONFLICT');
          const next = {content:b.content,version:b.expectedVersion+1,updatedAt:Date.now()};
          db.prepare('INSERT INTO participant_notes VALUES (?,?,?,?,?) ON CONFLICT(identity_id) DO UPDATE SET content=excluded.content,version=excluded.version,updated_at=excluded.updated_at').run(actor.id,actor.session_id,next.content,next.version,next.updatedAt);
          return next;
        });
        return json(res,200,{note});
      }
      if (path === '/api/me' && req.method === 'GET') {
        const a = authenticate(req); return json(res, 200, { sessionId: a.session_id, role: a.role });
      }
      const match = new RegExp(`^/api/sessions/([a-z]+)/(state|events|phase-command|phase-notes|team-review|team-admin|deliverable-review|incidents|incident-response|projector-access|report|actions/(${Object.keys(ACTION_PHASE).join('|')}))$`).exec(path);
      if (match) {
        const [, id, route, action] = match;
        const actor = authenticate(req); authorize(actor, id);
        if (route === 'state' && req.method === 'GET') return json(res, 200, state(id, actor));
        if (route === 'report' && req.method === 'GET') {
          authorize(actor, id, 'PARTICIPANT'); return json(res, 200, { sessionId: id, statisticsCode: state(id, actor).statisticsCode, mode: 'DEMO', warning: 'Simulación educativa; no es certificación ni auditoría real.', team: state(id, actor).team });
        }
        if (route === 'events' && req.method === 'GET') {
          const { token } = tokenFor(req);
          const tokenHash = hash(token);
          const expires = db.prepare('SELECT expires FROM tokens WHERE hash=?').get(tokenHash).expires;
          if ([...clients].filter(c => c.actor.id === actor.id).length >= 5) throw new ApiError(429, 'CONNECTION_LIMIT');
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write(`event: state\ndata: ${JSON.stringify(state(id, actor))}\n\n`);
          const c = { actor, res, expires, tokenHash }; clients.add(c);
          // Conexiones y reconexiones masivas: el contador de conectados se agrupa cada 250 ms.
          const presence = () => { if (actor.role === 'PARTICIPANT') emitStaff(id, 'presence.updated'); };
          presence();
          req.on('close', () => { if (clients.delete(c)) presence(); }); return;
        }
        if (route === 'projector-access' && req.method === 'POST') {
          authorize(actor, id, 'PRESENTER');
          const token = randomBytes(32).toString('base64url');
          const identityId = randomUUID();
          db.prepare('INSERT INTO identities VALUES (?,?,?,NULL)').run(identityId, id, 'PROJECTOR');
          db.prepare('INSERT INTO tokens VALUES (?,?,?)').run(hash(token), identityId, Date.now() + ttl);
          return json(res, 201, { token });
        }
        if(route==='team-review'&&req.method==='POST'){
          authorize(actor,id,'PRESENTER');const b=await body(req);
          const result=transaction(db,()=>{
            const old=teamReview(id),s=getSession(id);
            if(b.expectedVersion!==old.version)throw new ApiError(409,'REVIEW_VERSION_CONFLICT');
            let next;
            if(b.action==='HIDE')next={visible:false,version:old.version+1};
            else if(b.action==='SHOW'){
              if(!['ACTIVE','PAUSED'].includes(s.status)||s.phaseStage==='THEORY')throw new ApiError(409,'REVIEW_PRACTICE_REQUIRED');
              if(!text(b.teamId,100))throw new ApiError(400,'INVALID_TEAM');
              const row=db.prepare('SELECT data FROM teams WHERE id=? AND session_id=?').get(b.teamId,id);
              if(!row)throw new ApiError(404,'TEAM_NOT_FOUND');
              const count=db.prepare("SELECT COUNT(*) n FROM identities WHERE team_id=? AND role='PARTICIPANT'").get(b.teamId).n;
              next={...reviewSnapshot(JSON.parse(row.data),s.activePhase,count),visible:true,version:old.version+1};
            }else if(b.action==='PAGE'){
              if(!old.visible||!Number.isInteger(b.page)||b.page<0||b.page>=old.pages.length)throw new ApiError(400,'INVALID_REVIEW_PAGE');
              next={...old,page:b.page,version:old.version+1};
            }else throw new ApiError(400,'INVALID_COMMAND');
            db.prepare('INSERT INTO team_reviews VALUES (?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify(next));
            db.prepare('INSERT INTO phase_actions(session_id,actor_id,version,data,timestamp) VALUES (?,?,?,?,?)').run(id,actor.id,s.version,JSON.stringify({action:'TEAM_REVIEW_'+b.action,teamId:next.teamId??null,phase:next.phase??null}),Date.now());
            return state(id,actor);
          });
          emit(id,'team.review.updated','PRESENTER');emit(id,'team.review.updated','PROJECTOR');return json(res,200,result);
        }
        if (route === 'team-admin' && req.method === 'POST') {
          // Studio depura equipos o integrantes; revoca accesos y borra sus datos personales.
          authorize(actor, id, 'PRESENTER'); const b = await body(req);
          if (!['REMOVE_TEAM','REMOVE_MEMBER'].includes(b.action) || !text(b.teamId ?? b.memberId, 100)) throw new ApiError(400, 'INVALID_COMMAND');
          let removed = [], reviewChanged = false;
          const result = transaction(db, () => {
            const removeMember = memberId => {
              db.prepare('DELETE FROM tokens WHERE identity_id=?').run(memberId);
              db.prepare('DELETE FROM participant_notes WHERE identity_id=?').run(memberId);
              db.prepare('DELETE FROM participant_profiles WHERE identity_id=?').run(memberId);
              db.prepare('DELETE FROM identities WHERE id=?').run(memberId);
              removed.push(memberId);
            };
            if (b.action === 'REMOVE_MEMBER') {
              const member = db.prepare("SELECT id FROM identities WHERE id=? AND session_id=? AND role='PARTICIPANT'").get(b.memberId, id);
              if (!member) throw new ApiError(404, 'MEMBER_NOT_FOUND');
              removeMember(member.id);
            } else {
              const team = db.prepare('SELECT id FROM teams WHERE id=? AND session_id=?').get(b.teamId, id);
              if (!team) throw new ApiError(404, 'TEAM_NOT_FOUND');
              for (const member of db.prepare("SELECT id FROM identities WHERE team_id=? AND role='PARTICIPANT'").all(team.id)) removeMember(member.id);
              db.prepare('DELETE FROM incident_assignments WHERE team_id=?').run(team.id);
              const share = incidentShare(id);
              if (share.visible && share.teamId === team.id) { saveShare(id, { visible: false, version: share.version + 1 }); reviewChanged = true; }
              db.prepare('DELETE FROM team_names WHERE team_id=?').run(team.id);
              db.prepare('DELETE FROM teams WHERE id=?').run(team.id);
              const review = teamReview(id);
              if (review.visible && review.teamId === team.id) {
                db.prepare('INSERT INTO team_reviews VALUES (?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data').run(id, JSON.stringify({ visible: false, version: review.version + 1 }));
                reviewChanged = true;
              }
            }
            db.prepare('INSERT INTO phase_actions(session_id,actor_id,version,data,timestamp) VALUES (?,?,?,?,?)').run(id, actor.id, getSession(id).version, JSON.stringify({ action: b.action, teamId: b.teamId ?? null, members: removed.length }), Date.now());
            return state(id, actor);
          });
          // Cierra las conexiones en vivo de los accesos revocados antes de difundir el nuevo estado.
          for (const c of clients) if (removed.includes(c.actor.id)) { c.res.end(); clients.delete(c); }
          emit(id, 'team.progress');
          if (reviewChanged) { emit(id, 'team.review.updated', 'PRESENTER'); emit(id, 'team.review.updated', 'PROJECTOR'); }
          return json(res, 200, result);
        }
        if (route === 'incidents' && req.method === 'POST') {
          // Studio asigna, revela, comparte y cierra incidentes; cada acción queda auditada.
          authorize(actor, id, 'PRESENTER'); const b = await body(req);
          const actions = ['ASSIGN','UNASSIGN','REVEAL','HIDE','RESOLVE','SHARE','LEARNING','END_SHARE'];
          if (!actions.includes(b.action) || (!['LEARNING','END_SHARE'].includes(b.action) && (!text(b.teamId, 100) || !text(b.code, 20)))) throw new ApiError(400, 'INVALID_COMMAND');
          let reviewHidden = false, affectedTeam = b.teamId;
          const result = transaction(db, () => {
            const s = getSession(id), share = incidentShare(id);
            affectedTeam ??= share.teamId;
            const find = () => db.prepare('SELECT * FROM incident_assignments WHERE session_id=? AND team_id=? AND code=?').get(id, b.teamId, b.code);
            const setStatus = (status, column) => db.prepare(`UPDATE incident_assignments SET status=?${column ? `,${column}=?` : ''} WHERE session_id=? AND team_id=? AND code=?`).run(...[status, ...(column ? [Date.now()] : []), id, b.teamId, b.code]);
            if (['SHARE','LEARNING','END_SHARE'].includes(b.action) && b.expectedVersion !== share.version) throw new ApiError(409, 'INCIDENT_SHARE_CONFLICT');
            if (b.action === 'ASSIGN') {
              const definition = incidentByCode(b.code);
              if (!definition) throw new ApiError(404, 'INCIDENT_NOT_FOUND');
              if (!db.prepare('SELECT 1 FROM teams WHERE id=? AND session_id=?').get(b.teamId, id)) throw new ApiError(404, 'TEAM_NOT_FOUND');
              if (find()) throw new ApiError(409, 'INCIDENT_ALREADY_ASSIGNED');
              if (assignments(id, b.teamId).some(a => a.phase === definition.phaseId)) throw new ApiError(409, 'INCIDENT_PHASE_TAKEN');
              assignIncident(id, b.teamId, b.code, definition.phaseId, 'manual');
            } else if (['LEARNING','END_SHARE'].includes(b.action)) {
              if (!share.visible) throw new ApiError(409, 'INCIDENT_NOT_SHARED');
              if (b.action === 'LEARNING') saveShare(id, { ...share, learning: true, version: share.version + 1 });
              else {
                db.prepare("UPDATE incident_assignments SET status='discussed',discussed_at=? WHERE session_id=? AND team_id=? AND code=?").run(Date.now(), id, share.teamId, share.code);
                saveShare(id, { visible: false, version: share.version + 1 });
              }
            } else {
              const row = find();
              if (!row) throw new ApiError(404, 'INCIDENT_NOT_FOUND');
              if (b.action === 'UNASSIGN') {
                db.prepare('DELETE FROM incident_assignments WHERE session_id=? AND team_id=? AND code=?').run(id, b.teamId, b.code);
                if (incidentByCode(b.code).fixtureVariant === 'assertionless_test') {
                  const team = JSON.parse(db.prepare('SELECT data FROM teams WHERE id=?').get(b.teamId).data);
                  team.project = removeIncidentVariant(team.project, 'assertionless_test');
                  db.prepare('UPDATE teams SET data=? WHERE id=?').run(JSON.stringify(team), b.teamId);
                }
                if (share.visible && share.teamId === b.teamId && share.code === b.code) saveShare(id, { visible: false, version: share.version + 1 });
              }
              if (['REVEAL','SHARE'].includes(b.action) && (s.activePhase !== row.phase || !['ACTIVE','PAUSED'].includes(s.status))) throw new ApiError(409, 'INCIDENT_PHASE_MISMATCH');
              if (b.action === 'REVEAL' && row.status === 'assigned') setStatus('revealed', 'revealed_at');
              if (b.action === 'HIDE') { if (row.response) throw new ApiError(409, 'INCIDENT_HAS_RESPONSE'); setStatus('assigned'); }
              if (b.action === 'RESOLVE') { if (row.status === 'assigned') throw new ApiError(409, 'INCIDENT_NOT_REVEALED'); setStatus('resolved', 'resolved_at'); }
              if (b.action === 'SHARE') {
                if (row.status === 'assigned') throw new ApiError(409, 'INCIDENT_NOT_REVEALED');
                db.prepare('UPDATE incident_assignments SET shared_at=? WHERE session_id=? AND team_id=? AND code=?').run(Date.now(), id, b.teamId, b.code);
                saveShare(id, { visible: true, teamId: b.teamId, code: b.code, learning: false, version: share.version + 1 });
                // Una sola intervención en pantalla: compartir un incidente retira la revisión de entregas.
                const review = teamReview(id);
                if (review.visible) { db.prepare('UPDATE team_reviews SET data=? WHERE session_id=?').run(JSON.stringify({ visible: false, version: review.version + 1 }), id); reviewHidden = true; }
              }
            }
            db.prepare('INSERT INTO phase_actions(session_id,actor_id,version,data,timestamp) VALUES (?,?,?,?,?)').run(id, actor.id, s.version, JSON.stringify({ action: 'INCIDENT_' + b.action, teamId: b.teamId ?? share.teamId ?? null, code: b.code ?? share.code ?? null }), Date.now());
            return state(id, actor);
          });
          emit(id, 'incident.updated', teamAudience(affectedTeam));
          if (reviewHidden) { emit(id, 'team.review.updated', 'PRESENTER'); emit(id, 'team.review.updated', 'PROJECTOR'); }
          return json(res, 200, result);
        }
        if (route === 'incident-response' && req.method === 'POST') {
          // El equipo registra su decisión ante el incidente revelado de la fase en práctica.
          authorize(actor, id, 'PARTICIPANT'); const b = await body(req);
          if (!text(b.code, 20) || typeof b.choice !== 'string' || typeof b.justification !== 'string' || b.justification.trim().length < 10 || b.justification.length > 600) throw new ApiError(400, 'INCIDENT_RESPONSE_INVALID');
          const result = transaction(db, () => {
            const s = getSession(id);
            const row = db.prepare('SELECT * FROM incident_assignments WHERE session_id=? AND team_id=? AND code=?').get(id, actor.team_id, b.code);
            if (!row || row.status === 'assigned') throw new ApiError(404, 'INCIDENT_NOT_FOUND');
            requireActivePhase(s, row.phase);
            if (['resolved','discussed'].includes(row.status)) throw new ApiError(409, 'INCIDENT_CLOSED');
            if (!incidentByCode(b.code).choices.some(choice => choice.id === b.choice)) throw new ApiError(400, 'INCIDENT_RESPONSE_INVALID');
            db.prepare("UPDATE incident_assignments SET status='acknowledged',response=? WHERE session_id=? AND team_id=? AND code=?").run(JSON.stringify({ choice: b.choice, justification: b.justification.trim(), at: Date.now() }), id, actor.team_id, b.code);
            return state(id, actor);
          });
          emitTeamProgress(id, actor.team_id, 'incident.updated'); return json(res, 200, result);
        }
        if (route === 'deliverable-review' && req.method === 'POST') {
          // Studio acepta una entrega o pide revisarla; queda auditado y el equipo lo ve al instante.
          authorize(actor, id, 'PRESENTER'); const b = await body(req);
          if (!text(b.teamId, 100) || !Number.isInteger(b.phase) || b.phase < 1 || b.phase > PHASE_COUNT || !['ACCEPT','REQUEST_CHANGES'].includes(b.decision) || (b.comment !== undefined && typeof b.comment !== 'string') || (b.comment?.length ?? 0) > 500) throw new ApiError(400, 'INVALID_COMMAND');
          const result = transaction(db, () => {
            const row = db.prepare('SELECT data FROM teams WHERE id=? AND session_id=?').get(b.teamId, id);
            if (!row) throw new ApiError(404, 'TEAM_NOT_FOUND');
            const team = JSON.parse(row.data);
            team.project = reviewDeliverable(team.project, b.phase, b.decision, b.comment?.trim());
            db.prepare('UPDATE teams SET data=? WHERE id=?').run(JSON.stringify(team), b.teamId);
            db.prepare('INSERT INTO phase_actions(session_id,actor_id,version,data,timestamp) VALUES (?,?,?,?,?)').run(id, actor.id, getSession(id).version, JSON.stringify({ action: 'DELIVERABLE_' + b.decision, teamId: b.teamId, phase: b.phase }), Date.now());
            return state(id, actor);
          });
          emit(id, 'team.progress', teamAudience(b.teamId)); return json(res, 200, result);
        }
        if (route === 'phase-notes' && req.method === 'POST') {
          authorize(actor,id,'PRESENTER');
          const b=await body(req);
          if(!Number.isInteger(b.phase)||b.phase<1||b.phase>PHASE_COUNT||typeof b.content!=='string'||b.content.length>6000||!Number.isInteger(b.expectedVersion)) throw new ApiError(400,'INVALID_PHASE_NOTE');
          const note=transaction(db,()=>{
            const old=db.prepare('SELECT version FROM presenter_phase_notes WHERE session_id=? AND phase=?').get(id,b.phase);
            if((old?.version??0)!==b.expectedVersion) throw new ApiError(409,'PHASE_NOTE_VERSION_CONFLICT');
            const next={phase:b.phase,content:b.content,version:b.expectedVersion+1,updatedAt:Date.now()};
            db.prepare('INSERT INTO presenter_phase_notes VALUES (?,?,?,?,?) ON CONFLICT(session_id,phase) DO UPDATE SET content=excluded.content,version=excluded.version,updated_at=excluded.updated_at').run(id,b.phase,next.content,next.version,next.updatedAt);
            return next;
          });
          emit(id,'presenter.notes.updated','PRESENTER');return json(res,200,{note});
        }
        if (route === 'phase-command' && req.method === 'POST') {
          authorize(actor, id, 'PRESENTER'); const b = await body(req);
          if (!text(b.idempotencyKey, 128) || !Number.isInteger(b.expectedVersion) || (b.reason !== undefined && !text(b.reason, 500))) throw new ApiError(400, 'INVALID_COMMAND');
          let event;
          const result = transaction(db, () => {
            const request = JSON.stringify(b);
            const replay = db.prepare('SELECT * FROM idempotency WHERE session_id=? AND actor_id=? AND key=?').get(id, actor.id, b.idempotencyKey);
            if (replay) { if (replay.request !== request) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT'); return JSON.parse(replay.response); }
            const old = getSession(id);
            if (old.version !== b.expectedVersion) throw new ApiError(409, 'VERSION_CONFLICT', { currentVersion: old.version });
            const snapshot = state(id, actor);
            if (b.action === 'ADVANCE' && snapshot.summary.completed < snapshot.summary.total && b.confirm !== true) throw new ApiError(409, 'INCOMPLETE_TEAMS', { summary: snapshot.summary });
            const next = transition(old, b);
            if (b.action === 'ITERATE') {
              for (const row of db.prepare('SELECT id,data FROM teams WHERE session_id=?').all(id)) {
                const team = JSON.parse(row.data); team.project = startIteration(team.project ?? {}, old.iteration ?? 1);
                db.prepare('UPDATE teams SET data=? WHERE id=?').run(JSON.stringify(team), row.id);
              }
            }
            if(['START','ADVANCE','REOPEN','ITERATE','FINISH'].includes(b.action)){
              const review=teamReview(id);
              db.prepare('INSERT INTO team_reviews VALUES (?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data').run(id,JSON.stringify({visible:false,version:review.version+1}));
            }
            db.prepare('UPDATE sessions SET data=? WHERE id=?').run(JSON.stringify(next), id);
            if (next.phaseStage === 'PRACTICE' && ['PRACTICE','ITERATE'].includes(b.action)) autoAssign(id, next.activePhase);
            db.prepare('INSERT INTO phase_actions(session_id,actor_id,version,data,timestamp) VALUES (?,?,?,?,?)').run(id, actor.id, next.version, JSON.stringify({ action: b.action, fromPhase: old.activePhase, toPhase: next.activePhase, fromStatus: old.status, toStatus: next.status, reason: b.reason ?? null }), Date.now());
            const response = state(id, actor);
            db.prepare('INSERT INTO idempotency VALUES (?,?,?,?,?)').run(id, actor.id, b.idempotencyKey, request, JSON.stringify(response));
            event = ({ PRACTICE:'phase.practice', REFLECT: 'phase.reflection', CLOSE: 'phase.completed', START: 'session.started', ADVANCE: 'phase.opened', REOPEN: 'phase.opened', ITERATE: 'phase.opened', PAUSE: 'session.paused', RESUME: 'session.resumed', FINISH: 'session.finished', EXTEND: 'timer.updated' })[b.action];
            return response;
          });
          if (event) {
            if (['ADVANCE', 'REOPEN', 'ITERATE', 'FINISH'].includes(b.action)) emit(id, 'phase.closed');
            emit(id, event);
          }
          return json(res, 200, result);
        }
        if (action && req.method === 'POST') {
          authorize(actor, id, 'PARTICIPANT'); const b = await body(req);
          if (!text(b.idempotencyKey, 128)) throw new ApiError(400, 'IDEMPOTENCY_REQUIRED');
          const result = transaction(db, () => {
            const s = getSession(id); requireActivePhase(s, ACTION_PHASE[action]);
            if (b.expectedVersion !== s.version) throw new ApiError(409, 'VERSION_CONFLICT', { currentVersion: s.version });
            const request = JSON.stringify({ action, ...b });
            const replay = db.prepare('SELECT * FROM idempotency WHERE session_id=? AND actor_id=? AND key=?').get(id, actor.id, b.idempotencyKey);
            if (replay) { if (replay.request !== request) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT'); return JSON.parse(replay.response); }
            const row = db.prepare('SELECT data FROM teams WHERE id=? AND session_id=?').get(actor.team_id, id);
            const team = JSON.parse(row.data);
            const variants = assignments(id, actor.team_id).filter(a => a.phase === ACTION_PHASE[action]).map(a => incidentByCode(a.code).fixtureVariant).filter(Boolean);
            team.project = applyDemo(team.project, action, b, { iteration: s.iteration ?? 1, variants });
            db.prepare('UPDATE teams SET data=? WHERE id=?').run(JSON.stringify(team), actor.team_id);
            const response = state(id, actor);
            db.prepare('INSERT INTO idempotency VALUES (?,?,?,?,?)').run(id, actor.id, b.idempotencyKey, request, JSON.stringify(response));
            return response;
          });
          emitTeamProgress(id, actor.team_id); return json(res, 200, result);
        }
        throw new ApiError(405, 'METHOD_NOT_ALLOWED');
      }
      if (path === '/api/auth/projector' && req.method === 'POST') {
        const b = await body(req);
        if (!text(b.token, 100)) throw new ApiError(401, 'INVALID_CREDENTIALS');
        const row = db.prepare("SELECT t.* FROM tokens t JOIN identities i ON i.id=t.identity_id WHERE t.hash=? AND t.expires>? AND i.role='PROJECTOR'").get(hash(b.token), Date.now());
        if (!row) throw new ApiError(401, 'INVALID_CREDENTIALS');
        // El enlace es de un solo uso; se intercambia por cookie HttpOnly.
        db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(b.token));
        issue(res, { id: row.identity_id }); return json(res, 200, { ok: true });
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'METHOD_NOT_ALLOWED');
      const aliases = { '/': '/apps/participant/index.html', '/studio': '/apps/presenter/index.html', '/presenter': '/apps/presenter/index.html', '/projector': '/apps/projector/index.html' };
      const target = aliases[path] ?? path;
      if (['/apps/presenter/index.html', '/apps/projector/index.html'].includes(target)) {
        // La página de ingreso es pública; un participante autenticado no puede usarla como consola.
        let actor;
        try { actor = authenticate(req); } catch {}
        if (actor?.role === 'PARTICIPANT') {
          const privilegedNames = target.includes('/presenter/') ? ['ingenia_presenter'] : ['ingenia_presenter', 'ingenia_projector'];
          const privileged = privilegedNames.some(name => {
            const token = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie ?? '')?.[1];
            const row = token && db.prepare('SELECT i.role FROM tokens t JOIN identities i ON i.id=t.identity_id WHERE t.hash=? AND t.expires>?').get(hash(token), Date.now());
            return row && ['PRESENTER', 'PROJECTOR'].includes(row.role);
          });
          if (!privileged) throw new ApiError(403, 'FORBIDDEN');
        }
      }
      if (!['/packages/ui/assets/IMAGOTIPO_HORIZONTAL_BLANCO.png','/packages/ui/assets/fondo-verde-tecnologico.png'].includes(target) && !/^\/(apps|packages)\/[a-zA-Z0-9/_.-]+\.(html|css|mjs)$/.test(target)) throw new ApiError(404, 'NOT_FOUND');
      if (target.endsWith('.html') && !Object.values(aliases).includes(target)) throw new ApiError(404, 'NOT_FOUND');
      const file = resolve(root, `.${target}`);
      if (!file.startsWith(root) || target.includes('..')) throw new ApiError(404, 'NOT_FOUND');
      let content; try { content = readFileSync(file); } catch { throw new ApiError(404, 'NOT_FOUND'); }
      res.writeHead(200, { 'Content-Type': ({ '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' })[extname(file)] });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      if (!(error instanceof ApiError)) console.error(JSON.stringify({ level: 'error', requestId, code: 'INTERNAL_ERROR' }));
      json(res, error.status ?? 500, { error: error.code ?? 'INTERNAL_ERROR', ...error.meta, requestId });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (c.expires <= Date.now()) { c.res.end(); clients.delete(c); }
      else c.res.write(': heartbeat\n\n');
    }
    for (const [key, value] of rates) if (value.until < Date.now()) rates.delete(key);
  }, 15000);
  heartbeat.unref();
  return { server, db, close: async () => { clearInterval(heartbeat); for (const timer of coalesced.values()) clearTimeout(timer); for (const c of clients) c.res.end(); await new Promise(resolve => server.close(resolve)); db.close(); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1', () => console.log(JSON.stringify({ level: 'info', message: 'IngenIA DEMO disponible', url: `http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 3000}` })));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
