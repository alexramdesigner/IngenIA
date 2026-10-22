import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { sessionStatisticsCode } from '../../packages/shared/session-code.mjs';
import { TEAM_ROLES } from '../../packages/shared/team-roles.mjs';
import { teamKey } from '../../packages/shared/teams.mjs';
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, join_code TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS identities(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), role TEXT NOT NULL, team_id TEXT);
    CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY, identity_id TEXT NOT NULL REFERENCES identities(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), name TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(session_id,name));
    CREATE TABLE IF NOT EXISTS phase_actions(id INTEGER PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), actor_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, timestamp INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS idempotency(session_id TEXT NOT NULL, actor_id TEXT NOT NULL, key TEXT NOT NULL, request TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(session_id,actor_id,key));
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL, version INTEGER NOT NULL, timestamp INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS team_names(session_id TEXT NOT NULL REFERENCES sessions(id), name_key TEXT NOT NULL, team_id TEXT NOT NULL REFERENCES teams(id), PRIMARY KEY(session_id,name_key));
    CREATE TABLE IF NOT EXISTS participant_notes(identity_id TEXT PRIMARY KEY REFERENCES identities(id), session_id TEXT NOT NULL REFERENCES sessions(id), content TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS participant_profiles(identity_id TEXT PRIMARY KEY REFERENCES identities(id), session_id TEXT NOT NULL REFERENCES sessions(id), team_id TEXT NOT NULL REFERENCES teams(id), full_name TEXT NOT NULL, email TEXT, team_role TEXT, UNIQUE(session_id,email), UNIQUE(team_id,team_role));
    CREATE TABLE IF NOT EXISTS team_reviews(session_id TEXT PRIMARY KEY REFERENCES sessions(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS presenter_phase_notes(session_id TEXT NOT NULL REFERENCES sessions(id), phase INTEGER NOT NULL CHECK(phase BETWEEN 1 AND 5), content TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(session_id,phase));
    CREATE INDEX IF NOT EXISTS identities_team_members ON identities(team_id,role);
`);
  // Conserva los equipos históricos; el primer nombre equivalente se usa para nuevos ingresos.
  transaction(db, () => {
    const register = db.prepare('INSERT OR IGNORE INTO team_names VALUES (?,?,?)');
    for (const row of db.prepare('SELECT id,session_id,name FROM teams ORDER BY rowid').all()) register.run(row.session_id, teamKey(row.name), row.id);
  });
  const insert = db.prepare('INSERT OR IGNORE INTO sessions(id,join_code,data) VALUES (?, ?, ?)');
  for (const [id, start, end, title] of [['tarde', '14:00', '16:00', 'Grupo de la tarde'], ['noche', '18:00', '20:00', 'Grupo de la noche']]) {
    insert.run(id, randomBytes(6).toString('hex').toUpperCase(), JSON.stringify({ id, title, startAt: `2026-11-18T${start}:00-05:00`, endAt: `2026-11-18T${end}:00-05:00`, status: 'WAITING', activePhase: null, version: 0, deadline: null, remainingMs: 0, mode: 'DEMO' }));
  }
  transaction(db, () => {
    if (!db.prepare('PRAGMA table_info(sessions)').all().some(column => column.name === 'statistics_code')) db.exec('ALTER TABLE sessions ADD COLUMN statistics_code TEXT');
    for (const row of db.prepare('SELECT id,data FROM sessions WHERE statistics_code IS NULL').all()) {
      db.prepare('UPDATE sessions SET statistics_code=? WHERE id=?').run(sessionStatisticsCode(JSON.parse(row.data)),row.id);
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_statistics_code ON sessions(statistics_code); PRAGMA user_version=8;');
  });
  transaction(db,()=>{
    for(const member of db.prepare("SELECT * FROM identities WHERE role='PARTICIPANT' AND id NOT IN (SELECT identity_id FROM participant_profiles) ORDER BY rowid").all()) {
      const used=db.prepare('SELECT team_role FROM participant_profiles WHERE team_id=?').all(member.team_id).map(r=>r.team_role);
      const role=TEAM_ROLES.find(role=>!used.includes(role)) ?? null;
      db.prepare('INSERT INTO participant_profiles VALUES (?,?,?,?,?,?)').run(member.id,member.session_id,member.team_id,'',null,role);
    }
  });
  return db;
}
export function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
